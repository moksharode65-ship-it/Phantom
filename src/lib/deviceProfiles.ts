export interface DeviceProfile {
  appId: string
  deviceName: string
  userId: string
  meshNode: string
  imei: string
  model: string
  os: string
  battery: number
  signalDbm: number
  radioBattery: number
  packets: { sent: number; retried: number; lost: number }
  accent: string
  accentDeep: string
  home: { lat: number; lng: number }
  medical: string
  bio: string
  blood: string
}

export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  A: {
    appId: 'A',
    deviceName: 'SAFEZONE-1',
    userId: 'USER-MOB-01',
    meshNode: 'PNT-7K9M',
    imei: '91000-0001-000001',
    model: 'Pixel 8a',
    os: 'Android 15',
    battery: 82,
    signalDbm: -41,
    radioBattery: 73,
    packets: { sent: 1247, retried: 38, lost: 5 },
    accent: '#DC2626',
    accentDeep: '#991B1B',
    home: { lat: 19.06, lng: 72.86 },
    medical: '',
    bio: 'Daily commuter',
    blood: 'A+',
  },
  B: {
    appId: 'B',
    deviceName: 'SAFEZONE-2',
    userId: 'USER-MOB-02',
    meshNode: 'PNT-2B8D',
    imei: '91000-0002-000002',
    model: 'iPhone 16',
    os: 'iOS 18',
    battery: 64,
    signalDbm: -58,
    radioBattery: 58,
    packets: { sent: 986, retried: 27, lost: 7 },
    accent: '#2563EB',
    accentDeep: '#1D4ED8',
    home: { lat: 19.065, lng: 72.865 },
    medical: 'B+ · Penicillin allergy',
    bio: 'Night-shift nurse',
    blood: 'B+',
  },
  C: {
    appId: 'C',
    deviceName: 'SAFEZONE-3',
    userId: 'USER-MOB-03',
    meshNode: 'PNT-5T3X',
    imei: '91000-0003-000003',
    model: 'Galaxy S24',
    os: 'Android 14',
    battery: 47,
    signalDbm: -63,
    radioBattery: 41,
    packets: { sent: 412, retried: 12, lost: 9 },
    accent: '#16A34A',
    accentDeep: '#14532D',
    home: { lat: 19.05, lng: 72.86 },
    medical: 'O+ · Asthma',
    bio: 'Delivery rider',
    blood: 'O+',
  },
  D: {
    appId: 'D',
    deviceName: 'SAFEZONE-4',
    userId: 'USER-MOB-04',
    meshNode: 'PNT-9C2V',
    imei: '91000-0004-000004',
    model: 'OnePlus 12',
    os: 'OxygenOS 15',
    battery: 31,
    signalDbm: -72,
    radioBattery: 34,
    packets: { sent: 198, retried: 22, lost: 4 },
    accent: '#7C3AED',
    accentDeep: '#5B21B6',
    home: { lat: 19.055, lng: 72.855 },
    medical: 'A− · Insulin dependent',
    bio: 'Student',
    blood: 'A−',
  },
}
