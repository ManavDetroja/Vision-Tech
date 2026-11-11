export const services = [
  {
    id: 'cctv-installation',
    number: '01',
    title: 'CCTV Camera Installation',
    summary: 'Plan a camera setup around the spaces you want to monitor.',
    description: 'Discuss the property, surveillance priorities and available equipment before confirming an installation scope. Service availability depends on location and site requirements.',
    capabilities: [
      'Residential CCTV installation',
      'Commercial, office and shop surveillance',
      'Camera positioning and coverage planning',
      'CCTV system configuration'
    ],
    categoryIds: ['ip-cameras', 'nvr', 'poe-switches']
  },
  {
    id: 'cctv-repair',
    number: '02',
    title: 'CCTV Repair & Troubleshooting',
    summary: 'Investigate common camera, recording, display and network issues.',
    description: 'Start with the symptoms and existing system details. An inspection can help identify what may need attention; the work available is confirmed after the system and location are discussed.',
    capabilities: [
      'Camera connectivity problems',
      'Video feed and display issues',
      'Recording problems',
      'Network and connectivity troubleshooting',
      'Existing CCTV system inspection'
    ],
    categoryIds: ['ip-cameras', 'wi-fi-cameras', '4g-cameras', 'nvr']
  },
  {
    id: 'cctv-maintenance',
    number: '03',
    title: 'CCTV Maintenance',
    summary: 'Review cameras, recording, storage and system connections.',
    description: 'Maintenance needs vary by system. Discuss the equipment and any issues you have noticed so the appropriate inspection and available service can be confirmed.',
    capabilities: [
      'Camera inspection',
      'System health checks',
      'Recording and storage checks',
      'Cable and connection inspection',
      'General CCTV system maintenance'
    ],
    categoryIds: ['ip-cameras', 'nvr', 'poe-switches']
  },
  {
    id: 'cctv-upgrades',
    number: '04',
    title: 'CCTV System Upgrades',
    summary: 'Explore options for expanding or updating an existing setup.',
    description: 'An upgrade discussion can consider the current cameras, recorder, storage and network equipment alongside your requirements. Compatibility and service scope need to be checked for each system.',
    capabilities: [
      'Existing camera system upgrades',
      'Analog to IP CCTV system upgrades',
      'NVR and storage upgrades',
      'Network and PoE system improvements',
      'Expansion of existing camera systems'
    ],
    categoryIds: ['ip-cameras', 'nvr', 'poe-switches']
  },
  {
    id: 'security-consultation',
    number: '05',
    title: 'Security Consultation',
    summary: 'Talk through surveillance needs and possible CCTV equipment.',
    description: 'Share the space, areas of interest and existing equipment. Guidance can cover requirements, camera placement and product selection, subject to confirmation of service availability.',
    capabilities: [
      'CCTV system requirements assessment',
      'Camera placement recommendations',
      'Residential and commercial surveillance planning',
      'Product and system selection guidance'
    ],
    categoryIds: ['ip-cameras', 'wi-fi-cameras', '4g-cameras', 'solar-products', 'nvr', 'poe-switches']
  }
];

export const installationSteps = [
  {
    number: '01',
    title: 'Understand Customer Requirements',
    description: 'Discuss the property, the areas of interest and what you want the CCTV system to help monitor.'
  },
  {
    number: '02',
    title: 'Assess the Site and Coverage Requirements',
    description: 'Review the site and camera coverage needs. Site access and service availability are confirmed before the scope is agreed.'
  },
  {
    number: '03',
    title: 'Recommend Suitable CCTV Equipment',
    description: 'Compare suitable equipment options against the requirements and the existing system, where applicable.'
  },
  {
    number: '04',
    title: 'Installation and Configuration',
    description: 'If the service is confirmed, install and configure the agreed system components for the site.'
  },
  {
    number: '05',
    title: 'System Testing and Customer Handover',
    description: 'Review the installed setup and explain the agreed system functions during handover.'
  }
];

export const serviceFaqs = [
  {
    question: 'Which CCTV services can I enquire about?',
    answer: 'You can enquire about installation, repair and troubleshooting, maintenance, system upgrades, and security consultation. The available scope is confirmed for each request.'
  },
  {
    question: 'Are services available in every location?',
    answer: 'Service availability depends on location and site requirements. Share the general location through the contact page so availability can be confirmed.'
  },
  {
    question: 'Can you inspect an existing CCTV system?',
    answer: 'Existing-system inspection and troubleshooting are among the service categories listed here. Whether a particular system can be inspected or serviced is subject to confirmation.'
  },
  {
    question: 'How long does a CCTV installation take?',
    answer: 'Timing depends on the site, equipment and agreed scope. Any timing can be discussed after those requirements have been reviewed; no installation duration is promised here.'
  },
  {
    question: 'Can you recommend a camera or recording system?',
    answer: 'Security consultation can cover requirements, placement considerations and product selection. Recommendations depend on the details discussed and equipment suitability.'
  }
];
