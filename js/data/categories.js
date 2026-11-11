// Central catalogue taxonomy shared by the homepage and product catalogue.
export const categories = [
  { id: 'ip-cameras', name: 'IP Cameras', description: 'Network-connected camera solutions.', subcategories: ['Dome Cameras', 'Bullet Cameras'], icon: 'network' },
  { id: 'wi-fi-cameras', name: 'Wi-Fi Cameras', description: 'Wireless security cameras.', subcategories: ['PT Cameras'], icon: 'wifi' },
  { id: '4g-cameras', name: '4G Cameras', description: 'Camera options for cellular network locations.', subcategories: ['Dome Cameras', 'Bullet Cameras', 'PT Cameras'], icon: 'signal' },
  { id: 'solar-products', name: 'Solar Products', description: 'Solar security equipment category.', subcategories: [], icon: 'sun' },
  { id: 'nvr', name: 'NVR', description: 'Network video recorder category.', subcategories: [], icon: 'server' },
  { id: 'poe-switches', name: 'PoE Switches', description: 'Power over Ethernet switch category.', subcategories: [], icon: 'switch' }
];
