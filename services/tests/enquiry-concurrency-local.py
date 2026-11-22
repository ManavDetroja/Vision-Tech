"""Run against the disposable vt-p10a-local Docker project after both pending migrations."""
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from uuid import uuid4


PSQL = ["docker", "exec", "-i", "supabase_db_vt-p10a-local", "sh", "-c",
        "exec psql -XqAt -U postgres -d postgres 2>&1"]
EXPECTED_BODIES = [
    "1e75a87c88d251438c6ff9843d8b28d2",
    "cc22d18ab0a1f9b879da92edd922812c",
]


class Session:
    def __init__(self):
        self.process = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, encoding="utf-8")
        self.process.stdin.write("\\set VERBOSITY terse\n")
        self.run("set statement_timeout='15s'; set idle_in_transaction_session_timeout='30s'")
        self.pid = int(self.run("select pg_backend_pid()")[0])

    def run(self, sql, *, denied=False):
        proc = self.process
        proc.stdin.write(sql + ";\n\\echo END :SQLSTATE\n")
        proc.stdin.flush()
        rows = []
        while True:
            line = proc.stdout.readline()
            if not line:
                raise RuntimeError("Local psql exited unexpectedly")
            line = line.rstrip()
            if line.startswith("END "):
                break
            rows.append(line)
        if denied:
            assert line == "END P0001" and rows == ["ERROR:  Forbidden"], (line, rows)
        else:
            assert line == "END 00000" and not any(r.startswith("ERROR:") for r in rows), (line, rows)
        return rows

    def as_user(self, user):
        self.run(f"set role authenticated; set request.jwt.claim.sub='{user}'")

    def close(self):
        self.process.stdin.close()
        self.process.wait(timeout=20)
        self.process.stdout.close()


@contextmanager
def connection():
    session = Session()
    try:
        yield session
    finally:
        session.close()


def require_local_docker():
    assert not os.environ.get("DOCKER_HOST")
    endpoint = subprocess.check_output(
        ["docker", "context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}'],
        text=True).strip()
    assert endpoint.startswith(("npipe://", "unix://")), "Local Docker only"


def guard(db):
    bodies = db.run("""select md5(replace(prosrc,chr(13),''))
        from pg_proc where oid in ('public.admin_update_enquiry_status(uuid,text)'::regprocedure,
        'public.admin_set_enquiry_follow_up(uuid,timestamptz)'::regprocedure) order by proname""")
    assert bodies == EXPECTED_BODIES, "Requires the reviewed corrective migration"
    assert db.run("select to_regclass('public.notification_delivery') is not null") == ["t"]
    assert db.run("select count(*) from auth.users") == ["0"], "Requires a disposable empty project"


def blocked(db, waiter, holder):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if db.run(f"select {holder.pid} = any(pg_blocking_pids({waiter.pid}))") == ["t"]:
            return
        time.sleep(0.05)
    raise AssertionError("The expected database lock wait was never observed")


def exercise(db, staff, manager, new_owner, enquiry, actors):
    def assign(to):
        return f"select id from public.admin_assign_enquiry('{enquiry}','{to}')"

    operations = {
        "status": f"select * from public.admin_update_enquiry_status('{enquiry}','CLOSED')",
        "follow-up": f"select * from public.admin_set_enquiry_follow_up('{enquiry}',now()-interval '1 day')",
    }

    def snapshot():
        return db.run(f"""select status,follow_up_at,updated_at,
          (select count(*) from public.admin_activity where entity_id=e.id),
          (select count(*) from public.admin_notifications where enquiry_id=e.id),
          (select count(*) from public.notification_delivery d join public.admin_notifications n
             on n.id=d.notification_id where n.enquiry_id=e.id)
          from public.enquiries e where id='{enquiry}'""")

    with connection() as unrelated:
        unrelated.as_user(new_owner)
        before = snapshot()
        for write in operations.values():
            unrelated.run(write, denied=True)
        assert before == snapshot()
        print("PASS never-assigned staff: both operations denied without exposing or changing the enquiry")

    with ThreadPoolExecutor(max_workers=1) as pool:
        for label, write in operations.items():
            manager.run(assign(actors["STAFF"]))
            manager.run("begin")
            manager.run(assign(new_owner))
            request = pool.submit(staff.run, write, denied=True)
            blocked(db, staff, manager)
            manager.run("commit")
            request.result(timeout=20)
            before = snapshot()
            staff.run(write, denied=True)
            db.run("select public.enqueue_due_followups()")
            assert before == snapshot()
            assert db.run(f"""select status='NEW' and follow_up_at is null and assigned_to='{new_owner}'
                from public.enquiries where id='{enquiry}'""") == ["t"]
            assert db.run(f"""select count(*) from public.admin_activity where entity_id='{enquiry}'
                and action in ('ENQUIRY_STATUS_CHANGED','ENQUIRY_FOLLOW_UP_CHANGED')""") == ["0"]
            assert db.run(f"""select count(*) from public.admin_notifications where enquiry_id='{enquiry}'
                and kind in ('ENQUIRY_CLOSED','FOLLOW_UP_DUE')""") == ["0"]
            print(f"PASS {label}: reassignment held the row, waiting write denied, no data or event")

        for label, write in reversed(list(operations.items())):
            manager.run(assign(actors["STAFF"]))
            staff.run("begin")
            assert len(staff.run(write)) == 1
            assignment = pool.submit(manager.run, assign(new_owner))
            blocked(db, manager, staff)
            staff.run("commit")
            assert assignment.result(timeout=20) == [enquiry]
            assert db.run(f"select assigned_to from public.enquiries where id='{enquiry}'") == [new_owner]
            if label == "follow-up":
                db.run("select public.enqueue_due_followups()")
                assert db.run(f"""select recipient_id from public.admin_notifications where
                    enquiry_id='{enquiry}' and kind='FOLLOW_UP_DUE'""") == [new_owner]
            print(f"PASS {label}: authorized write held the row, then reassignment committed")

    for action in ("ENQUIRY_STATUS_CHANGED", "ENQUIRY_FOLLOW_UP_CHANGED"):
        assert db.run(f"""select actor_id from public.admin_activity where entity_id='{enquiry}'
            and action='{action}'""") == [actors["STAFF"]]
    recipients = sorted([actors[k] for k in ("STAFF","ADMIN","SUPER_ADMIN")])
    assert db.run(f"""select n.recipient_id from public.admin_notifications n
        join public.notification_delivery d on d.notification_id=n.id where n.enquiry_id='{enquiry}'
        and n.kind='ENQUIRY_CLOSED' order by n.recipient_id""") == recipients
    print("PASS exact authorized audit actors, reminder recipient and three outcome delivery jobs")
    for role in ("ADMIN", "SUPER_ADMIN"):
        manager.as_user(actors[role])
        for write in operations.values():
            assert len(manager.run(write)) == 1
        print(f"PASS {role} may update status and follow-up on another assignee's enquiry")


def main():
    if not __debug__:
        raise RuntimeError("Run with Python assertions enabled")
    require_local_docker()
    with connection() as db:
        guard(db)
        actors = {key: str(uuid4()) for key in ("STAFF","OTHER","ADMIN","SUPER_ADMIN")}
        ids = ",".join(f"'{u}'" for u in actors.values())
        enquiry = str(uuid4())
        try:
            for label, user in actors.items():
                role = "STAFF" if label == "OTHER" else label
                db.run(f"insert into auth.users(id,email) values('{user}','{user}@example.invalid')")
                db.run(f"update public.profiles set role='{role}',account_state='ACTIVE' where id='{user}'")
            db.run(f"""insert into public.enquiries(id,enquiry_code,idempotency_key,customer_name,
                customer_email,customer_phone,enquiry_type,customer_message,consented_at,assigned_to)
                values('{enquiry}','LOCAL-{enquiry}',gen_random_uuid(),'Local fixture','','0000000000',
                'GENERAL_ENQUIRY','Disposable concurrency check',now(),'{actors["STAFF"]}')""")
            with connection() as staff, connection() as manager:
                staff.as_user(actors["STAFF"])
                manager.as_user(actors["ADMIN"])
                exercise(db, staff, manager, actors["OTHER"], enquiry, actors)
        finally:
            db.run(f"delete from public.admin_activity where entity_id='{enquiry}' or actor_id in ({ids})")
            db.run(f"delete from public.enquiries where id='{enquiry}'")
            db.run(f"delete from auth.users where id in ({ids})")


if __name__ == "__main__":
    main()
