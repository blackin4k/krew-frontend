import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const NotificationPermissionHandler = () => {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let cancelled = false;

        const requestPermissions = async () => {
            try {
                const status = await LocalNotifications.checkPermissions();
                if (!cancelled && status.display !== 'granted') {
                    await LocalNotifications.requestPermissions();
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error requesting notification permissions:', error);
                }
            }
        };

        // Avoid blocking first paint with a native permission prompt.
        const timer = window.setTimeout(() => {
            requestPermissions();
        }, 2500);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, []);

    return null;
};

export default NotificationPermissionHandler;
