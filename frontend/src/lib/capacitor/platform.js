import { Capacitor } from '@capacitor/core';

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function getPlatform() {
  return Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
}

export function isAndroid() {
  return getPlatform() === 'android';
}

export function isIos() {
  return getPlatform() === 'ios';
}
