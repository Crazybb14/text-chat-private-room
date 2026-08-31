export function getDeviceId(): string {
  const DEVICE_ID_KEY = 'chat_device_id';
  const DEVICE_ID_LENGTH = 100;

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    deviceId = result;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

export default getDeviceId;
