export type PlatformType = 'android' | 'ios' | 'both';

export type AndroidProtectionLevel = 'normal' | 'dangerous' | 'signature' | 'special';

export interface PermissionItem {
  id: string;                               // Unique key (e.g., 'camera', 'location_fine')
  displayName: string;                      // User-friendly name for UI dropdowns/trees
  platform: PlatformType;
  category: string;                         // Grouping category
  androidManifestName?: string;             // Exact name for AndroidManifest.xml
  androidProtectionLevel?: AndroidProtectionLevel;
  androidMinSdk?: number;                   // Min SDK when introduced or modified
  androidMaxSdk?: number;                   // Deprecation or max SDK cap (e.g., WRITE_EXTERNAL_STORAGE = 29)
  adbPermissionName?: string;               // Exact identifier used for `pm grant/revoke`
  iosKey?: string;                          // Exact Info.plist key (e.g., NSCameraUsageDescription)
  iosMinVersion?: string;                   // Minimum iOS version required (e.g., '17.0')
  defaultIosUsageDescription?: string;      // Recommended default explanation for Info.plist usage description
  hint: string;                             // Clear explanation of what this permission does and when it is needed
  storeReviewWarning?: string;              // Optional warning about Play Store / App Store rejection risks or privacy policies
  flutterPackageRecommendation?: string[];   // Common Flutter plugins utilizing this (e.g., ['camera', 'image_picker'])
}

export interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;                            // VS Code Codicon identifier (e.g., 'camera', 'globe', 'shield')
  permissions: PermissionItem[];
}

export const PERMISSION_CATALOG: PermissionCategory[] = [
  {
    id: 'network_connectivity',
    name: 'Network & Connectivity',
    description: 'Internet, Wi-Fi states, network monitoring, and Near-Field Communication.',
    icon: 'globe',
    permissions: [
      {
        id: 'internet',
        displayName: 'Internet Access',
        platform: 'android',
        category: 'network_connectivity',
        androidManifestName: 'android.permission.INTERNET',
        androidProtectionLevel: 'normal',
        hint: 'Required by Flutter HTTP clients (dio, http) and image caching to open network sockets. Missing this causes SocketException on Android devices.',
        flutterPackageRecommendation: ['http', 'dio', 'cached_network_image']
      },
      {
        id: 'access_network_state',
        displayName: 'Access Network State',
        platform: 'android',
        category: 'network_connectivity',
        androidManifestName: 'android.permission.ACCESS_NETWORK_STATE',
        androidProtectionLevel: 'normal',
        hint: 'Allows checking whether the device is connected to Wi-Fi, cellular, or offline. Essential for connectivity listener plugins.',
        flutterPackageRecommendation: ['connectivity_plus', 'internet_connection_checker_plus']
      },
      {
        id: 'access_wifi_state',
        displayName: 'Access Wi-Fi State',
        platform: 'android',
        category: 'network_connectivity',
        androidManifestName: 'android.permission.ACCESS_WIFI_STATE',
        androidProtectionLevel: 'normal',
        hint: 'Enables querying Wi-Fi network information such as SSID, BSSID, and link speed.',
        flutterPackageRecommendation: ['network_info_plus', 'wifi_info_flutter']
      },
      {
        id: 'change_wifi_state',
        displayName: 'Change Wi-Fi State',
        platform: 'android',
        category: 'network_connectivity',
        androidManifestName: 'android.permission.CHANGE_WIFI_STATE',
        androidProtectionLevel: 'normal',
        hint: 'Allows IoT onboarding, Wi-Fi network scanning, and programmatic Wi-Fi connection.',
        flutterPackageRecommendation: ['wifi_iot', 'wifi_scan']
      },
      {
        id: 'nfc',
        displayName: 'Near Field Communication (NFC)',
        platform: 'android',
        category: 'network_connectivity',
        androidManifestName: 'android.permission.NFC',
        androidProtectionLevel: 'normal',
        hint: 'Required to communicate with contactless RFID/NFC tags and smart cards over the NFC radio.',
        flutterPackageRecommendation: ['nfc_manager', 'flutter_nfc_kit']
      }
    ]
  },
  {
    id: 'camera_optical',
    name: 'Camera & Optical Devices',
    description: 'Hardware camera feed, flash control, and visual barcode scanning.',
    icon: 'device-camera',
    permissions: [
      {
        id: 'camera',
        displayName: 'Camera',
        platform: 'both',
        category: 'camera_optical',
        androidManifestName: 'android.permission.CAMERA',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.CAMERA',
        iosKey: 'NSCameraUsageDescription',
        defaultIosUsageDescription: 'This app requires access to the camera to take photos and scan QR codes.',
        hint: 'Required by plugins like camera, mobile_scanner, or qr_code_scanner to capture live camera feed and photos. On iOS, missing NSCameraUsageDescription causes an immediate app crash upon opening the camera.',
        flutterPackageRecommendation: ['camera', 'image_picker', 'mobile_scanner']
      },
      {
        id: 'flashlight',
        displayName: 'Flashlight',
        platform: 'android',
        category: 'camera_optical',
        androidManifestName: 'android.permission.FLASHLIGHT',
        androidProtectionLevel: 'normal',
        hint: 'Allows turning the device torch/flashlight on and off without holding the camera capture pipeline open.',
        flutterPackageRecommendation: ['torch_light', 'lamp']
      }
    ]
  },
  {
    id: 'microphone_audio',
    name: 'Microphone & Audio',
    description: 'Audio recording, speech-to-text, and audio session routing.',
    icon: 'mic',
    permissions: [
      {
        id: 'record_audio',
        displayName: 'Microphone / Record Audio',
        platform: 'both',
        category: 'microphone_audio',
        androidManifestName: 'android.permission.RECORD_AUDIO',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.RECORD_AUDIO',
        iosKey: 'NSMicrophoneUsageDescription',
        defaultIosUsageDescription: 'This app requires access to the microphone to record audio.',
        hint: 'Required for audio recording, voice notes, and VoIP call audio streams. On iOS, accessing audio hardware without NSMicrophoneUsageDescription crashes the app instantly.',
        flutterPackageRecommendation: ['record', 'audioplayers', 'flutter_sound']
      },
      {
        id: 'modify_audio_settings',
        displayName: 'Modify Audio Settings',
        platform: 'android',
        category: 'microphone_audio',
        androidManifestName: 'android.permission.MODIFY_AUDIO_SETTINGS',
        androidProtectionLevel: 'normal',
        hint: 'Required to configure audio routing, switch between earpiece and loudspeaker, or control hardware volume channels.',
        flutterPackageRecommendation: ['audio_session', 'flutter_incall_manager']
      },
      {
        id: 'speech_recognition_ios',
        displayName: 'Speech Recognition (iOS)',
        platform: 'ios',
        category: 'microphone_audio',
        iosKey: 'NSSpeechRecognitionUsageDescription',
        defaultIosUsageDescription: 'This app uses speech recognition to transcribe your spoken voice into text.',
        hint: 'Required when sending live or recorded user audio to Apple speech servers for automatic speech-to-text transcription.',
        storeReviewWarning: 'App Store review requires clear explanation in NSSpeechRecognitionUsageDescription of how user speech data is processed and transcribed.',
        flutterPackageRecommendation: ['speech_to_text']
      }
    ]
  },
  {
    id: 'storage_media',
    name: 'Storage & Media Files',
    description: 'Photo library, shared media, scoped storage, and broad file system management.',
    icon: 'folder-library',
    permissions: [
      {
        id: 'read_external_storage',
        displayName: 'Read External Storage (Legacy)',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.READ_EXTERNAL_STORAGE',
        androidProtectionLevel: 'dangerous',
        androidMaxSdk: 32,
        adbPermissionName: 'android.permission.READ_EXTERNAL_STORAGE',
        hint: 'Legacy storage read access for Android 12 and below (API <= 32). On Android 13+, apps should declare granular media permissions (READ_MEDIA_*) instead.',
        flutterPackageRecommendation: ['permission_handler', 'file_picker']
      },
      {
        id: 'write_external_storage',
        displayName: 'Write External Storage (Legacy)',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.WRITE_EXTERNAL_STORAGE',
        androidProtectionLevel: 'dangerous',
        androidMaxSdk: 29,
        adbPermissionName: 'android.permission.WRITE_EXTERNAL_STORAGE',
        hint: 'Legacy storage write access for Android 9 and below (API <= 29). Scoped storage on Android 10+ restricts arbitrary file writes.',
        flutterPackageRecommendation: ['permission_handler', 'path_provider']
      },
      {
        id: 'read_media_images',
        displayName: 'Read Media Images (Android 13+ / iOS Photos)',
        platform: 'both',
        category: 'storage_media',
        androidManifestName: 'android.permission.READ_MEDIA_IMAGES',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 33,
        adbPermissionName: 'android.permission.READ_MEDIA_IMAGES',
        iosKey: 'NSPhotoLibraryUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your photo library to select and upload photos and videos.',
        hint: 'Allows selecting and reading images from the device gallery. Required on Android 13+ (API 33) for photo picking without opening legacy storage. On iOS, NSPhotoLibraryUsageDescription is required for read access.',
        flutterPackageRecommendation: ['image_picker', 'photo_manager', 'wechat_assets_picker']
      },
      {
        id: 'read_media_video',
        displayName: 'Read Media Video',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.READ_MEDIA_VIDEO',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 33,
        adbPermissionName: 'android.permission.READ_MEDIA_VIDEO',
        hint: 'Allows reading user video files from shared storage on Android 13+ (API 33+) under granular media permissions.',
        flutterPackageRecommendation: ['image_picker', 'photo_manager', 'file_picker']
      },
      {
        id: 'read_media_audio',
        displayName: 'Read Media Audio / Music Library',
        platform: 'both',
        category: 'storage_media',
        androidManifestName: 'android.permission.READ_MEDIA_AUDIO',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 33,
        adbPermissionName: 'android.permission.READ_MEDIA_AUDIO',
        iosKey: 'NSAppleMusicUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your music and media library to play audio tracks.',
        hint: 'Grants access to audio files in shared storage on Android 13+ (API 33+) and the user Apple Music / Media Library on iOS.',
        flutterPackageRecommendation: ['on_audio_query', 'audioplayers', 'music_player']
      },
      {
        id: 'read_media_visual_user_selected',
        displayName: 'Partial Visual Media Access (Android 14+)',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 34,
        adbPermissionName: 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        hint: 'Introduced in Android 14 (API 34) to support user-selected partial photo/video access, matching iOS selected photos permission UX.',
        flutterPackageRecommendation: ['photo_manager', 'permission_handler']
      },
      {
        id: 'access_media_location',
        displayName: 'Access Media Location (EXIF GPS)',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.ACCESS_MEDIA_LOCATION',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 29,
        adbPermissionName: 'android.permission.ACCESS_MEDIA_LOCATION',
        hint: 'Required on Android 10+ (API 29+) to retrieve unredacted geographic metadata (EXIF GPS coordinates) from images and videos.',
        flutterPackageRecommendation: ['photo_manager', 'exif']
      },
      {
        id: 'manage_external_storage',
        displayName: 'Manage All Files (Special Access)',
        platform: 'android',
        category: 'storage_media',
        androidManifestName: 'android.permission.MANAGE_EXTERNAL_STORAGE',
        androidProtectionLevel: 'special',
        androidMinSdk: 30,
        hint: 'Grants broad all-files access across device storage on Android 11+ (API 30+). Requires directing the user to Settings.',
        storeReviewWarning: 'Google Play strictly restricts MANAGE_EXTERNAL_STORAGE to core file manager, antivirus, or backup apps. Apps lacking acceptable core utility will be rejected from Google Play.',
        flutterPackageRecommendation: ['permission_handler']
      },
      {
        id: 'photo_library_add_ios',
        displayName: 'Add to Photo Library (iOS)',
        platform: 'ios',
        category: 'storage_media',
        iosKey: 'NSPhotoLibraryAddUsageDescription',
        defaultIosUsageDescription: 'This app requires permission to save photos and media directly to your photo library.',
        hint: 'Allows saving photos or videos into the user gallery without requesting broad read access to existing photos.',
        flutterPackageRecommendation: ['image_gallery_saver', 'gal', 'saver_gallery']
      }
    ]
  },
  {
    id: 'location_geolocation',
    name: 'Location & Geolocation',
    description: 'Coarse, fine GPS, and continuous background location tracking.',
    icon: 'location',
    permissions: [
      {
        id: 'location_coarse',
        displayName: 'Approximate Location (Coarse)',
        platform: 'android',
        category: 'location_geolocation',
        androidManifestName: 'android.permission.ACCESS_COARSE_LOCATION',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.ACCESS_COARSE_LOCATION',
        hint: 'Allows obtaining approximate device location derived from cellular network and Wi-Fi access points (typically within a city block).',
        flutterPackageRecommendation: ['geolocator', 'location']
      },
      {
        id: 'location_fine',
        displayName: 'Precise Location (Fine / Foreground)',
        platform: 'both',
        category: 'location_geolocation',
        androidManifestName: 'android.permission.ACCESS_FINE_LOCATION',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.ACCESS_FINE_LOCATION',
        iosKey: 'NSLocationWhenInUseUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your location while in use to provide accurate location services.',
        hint: 'Grants precise GPS location coordinates while the app is active in foreground. On iOS, NSLocationWhenInUseUsageDescription must explain why precise location is required.',
        flutterPackageRecommendation: ['geolocator', 'location', 'google_maps_flutter']
      },
      {
        id: 'location_background',
        displayName: 'Background Location',
        platform: 'both',
        category: 'location_geolocation',
        androidManifestName: 'android.permission.ACCESS_BACKGROUND_LOCATION',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 29,
        adbPermissionName: 'android.permission.ACCESS_BACKGROUND_LOCATION',
        iosKey: 'NSLocationAlwaysAndWhenInUseUsageDescription',
        defaultIosUsageDescription: 'This app requires background location access to provide continuous tracking even when minimized.',
        hint: 'Enables continuous location tracking even when the app is minimized or the screen is off. Must be requested separately from foreground location.',
        storeReviewWarning: 'Google Play and Apple App Store subject background location to prominent disclosure and strict review. Apps must demonstrate clear user-facing utility (e.g. turn-by-turn navigation or fitness tracking).',
        flutterPackageRecommendation: ['background_locator_2', 'geolocator']
      },
      {
        id: 'location_always_legacy_ios',
        displayName: 'Location Always (Legacy iOS <= 10)',
        platform: 'ios',
        category: 'location_geolocation',
        iosKey: 'NSLocationAlwaysUsageDescription',
        defaultIosUsageDescription: 'This app requires continuous access to your location.',
        hint: 'Legacy iOS 10 and earlier key for background location. On iOS 11+, NSLocationAlwaysAndWhenInUseUsageDescription is required alongside this key.',
        flutterPackageRecommendation: ['geolocator', 'location']
      }
    ]
  },
  {
    id: 'bluetooth_nearby',
    name: 'Bluetooth & Nearby Connectivity',
    description: 'BLE scanning, peripherals, Bluetooth Classic, and local Wi-Fi multicast network.',
    icon: 'broadcast',
    permissions: [
      {
        id: 'bluetooth_scan',
        displayName: 'Bluetooth Scan (Android 12+)',
        platform: 'android',
        category: 'bluetooth_nearby',
        androidManifestName: 'android.permission.BLUETOOTH_SCAN',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 31,
        adbPermissionName: 'android.permission.BLUETOOTH_SCAN',
        hint: 'Required on Android 12+ (API 31+) to discover nearby Bluetooth and BLE peripherals. Can be annotated with android:usesPermissionFlags="neverForLocation" if location is not derived.',
        flutterPackageRecommendation: ['flutter_blue_plus', 'flutter_reactive_ble']
      },
      {
        id: 'bluetooth_connect',
        displayName: 'Bluetooth Connect (Android 12+ / iOS Always)',
        platform: 'both',
        category: 'bluetooth_nearby',
        androidManifestName: 'android.permission.BLUETOOTH_CONNECT',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 31,
        adbPermissionName: 'android.permission.BLUETOOTH_CONNECT',
        iosKey: 'NSBluetoothAlwaysUsageDescription',
        defaultIosUsageDescription: 'This app requires Bluetooth access to connect to and communicate with nearby devices.',
        hint: 'Allows connecting and exchanging data with paired Bluetooth devices on Android 12+ (API 31+). On iOS 13+, NSBluetoothAlwaysUsageDescription is required for CoreBluetooth access.',
        flutterPackageRecommendation: ['flutter_blue_plus', 'flutter_reactive_ble']
      },
      {
        id: 'bluetooth_advertise',
        displayName: 'Bluetooth Advertise (Android 12+)',
        platform: 'android',
        category: 'bluetooth_nearby',
        androidManifestName: 'android.permission.BLUETOOTH_ADVERTISE',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 31,
        adbPermissionName: 'android.permission.BLUETOOTH_ADVERTISE',
        hint: 'Required on Android 12+ (API 31+) to advertise the device as a BLE peripheral to other nearby devices.',
        flutterPackageRecommendation: ['flutter_ble_peripheral', 'flutter_blue_plus']
      },
      {
        id: 'bluetooth_legacy',
        displayName: 'Bluetooth (Legacy Android <= 11)',
        platform: 'android',
        category: 'bluetooth_nearby',
        androidManifestName: 'android.permission.BLUETOOTH',
        androidProtectionLevel: 'normal',
        androidMaxSdk: 30,
        hint: 'Legacy permission on Android 11 and earlier (API <= 30) for basic Bluetooth communication.',
        flutterPackageRecommendation: ['flutter_blue_plus', 'flutter_bluetooth_serial']
      },
      {
        id: 'bluetooth_admin_legacy',
        displayName: 'Bluetooth Admin (Legacy Android <= 11)',
        platform: 'android',
        category: 'bluetooth_nearby',
        androidManifestName: 'android.permission.BLUETOOTH_ADMIN',
        androidProtectionLevel: 'normal',
        androidMaxSdk: 30,
        hint: 'Legacy permission on Android 11 and earlier (API <= 30) to initiate device discovery or manipulate Bluetooth settings.',
        flutterPackageRecommendation: ['flutter_bluetooth_serial']
      },
      {
        id: 'bluetooth_peripheral_legacy_ios',
        displayName: 'Bluetooth Peripheral (Legacy iOS <= 12)',
        platform: 'ios',
        category: 'bluetooth_nearby',
        iosKey: 'NSBluetoothPeripheralUsageDescription',
        defaultIosUsageDescription: 'This app requires Bluetooth access to act as a peripheral and share data with nearby devices.',
        hint: 'Legacy iOS 12 and earlier key for sharing data via CoreBluetooth. Deprecated in iOS 13 in favor of NSBluetoothAlwaysUsageDescription.',
        flutterPackageRecommendation: ['flutter_blue_plus']
      },
      {
        id: 'local_network_ios',
        displayName: 'Local Network Discovery (iOS 14+)',
        platform: 'ios',
        category: 'bluetooth_nearby',
        iosKey: 'NSLocalNetworkUsageDescription',
        iosMinVersion: '14.0',
        defaultIosUsageDescription: 'This app requires access to the local network to discover and communicate with local devices.',
        hint: 'Required on iOS 14+ when discovering or connecting to devices on the local Wi-Fi network via Bonjour, mDNS, or direct IP sockets.',
        flutterPackageRecommendation: ['network_info_plus', 'bonsoir']
      }
    ]
  },
  {
    id: 'contacts_calendar_reminders',
    name: 'Contacts, Calendar & Reminders',
    description: 'Device address book, calendar events, and reminder task lists.',
    icon: 'calendar',
    permissions: [
      {
        id: 'read_contacts',
        displayName: 'Read Contacts',
        platform: 'both',
        category: 'contacts_calendar_reminders',
        androidManifestName: 'android.permission.READ_CONTACTS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.READ_CONTACTS',
        iosKey: 'NSContactsUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your contacts to let you connect with and invite friends.',
        hint: 'Allows accessing device contacts list and reading names, phone numbers, and emails. On iOS, NSContactsUsageDescription is required.',
        flutterPackageRecommendation: ['flutter_contacts', 'contacts_service']
      },
      {
        id: 'write_contacts',
        displayName: 'Write Contacts',
        platform: 'android',
        category: 'contacts_calendar_reminders',
        androidManifestName: 'android.permission.WRITE_CONTACTS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.WRITE_CONTACTS',
        hint: 'Allows adding, modifying, or deleting contacts in the device address book over Android ContactsProvider.',
        flutterPackageRecommendation: ['flutter_contacts']
      },
      {
        id: 'read_calendar',
        displayName: 'Read Calendar',
        platform: 'both',
        category: 'contacts_calendar_reminders',
        androidManifestName: 'android.permission.READ_CALENDAR',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.READ_CALENDAR',
        iosKey: 'NSCalendarsUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your calendar to display and manage your scheduled events.',
        hint: 'Allows reading calendar events and attendees from device calendars. On iOS <= 16, NSCalendarsUsageDescription covers read/write.',
        flutterPackageRecommendation: ['device_calendar', 'manage_calendar_events']
      },
      {
        id: 'write_calendar',
        displayName: 'Write Calendar',
        platform: 'android',
        category: 'contacts_calendar_reminders',
        androidManifestName: 'android.permission.WRITE_CALENDAR',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.WRITE_CALENDAR',
        hint: 'Allows creating, modifying, or deleting calendar appointments and reminders on Android devices.',
        flutterPackageRecommendation: ['device_calendar']
      },
      {
        id: 'calendar_full_access_ios',
        displayName: 'Calendar Full Access (iOS 17+)',
        platform: 'ios',
        category: 'contacts_calendar_reminders',
        iosKey: 'NSCalendarsFullAccessUsageDescription',
        iosMinVersion: '17.0',
        defaultIosUsageDescription: 'This app requires full access to your calendar to view, create, and manage events.',
        hint: 'Introduced in iOS 17.0 for reading and writing full calendar events. Replaces NSCalendarsUsageDescription for comprehensive calendar operations.',
        flutterPackageRecommendation: ['device_calendar']
      },
      {
        id: 'calendar_write_only_ios',
        displayName: 'Calendar Write-Only Access (iOS 17+)',
        platform: 'ios',
        category: 'contacts_calendar_reminders',
        iosKey: 'NSCalendarsWriteOnlyAccessUsageDescription',
        iosMinVersion: '17.0',
        defaultIosUsageDescription: 'This app requires permission to add new events and appointments to your calendar.',
        hint: 'Introduced in iOS 17.0 to allow adding events to the user calendar without granting permission to read existing personal appointments.',
        flutterPackageRecommendation: ['device_calendar', 'add_2_calendar']
      },
      {
        id: 'reminders_legacy_ios',
        displayName: 'Reminders (iOS <= 16)',
        platform: 'ios',
        category: 'contacts_calendar_reminders',
        iosKey: 'NSRemindersUsageDescription',
        defaultIosUsageDescription: 'This app requires access to your reminders to organize and track your tasks.',
        hint: 'Allows accessing and modifying reminders and task lists in the iOS Reminders app for iOS 16 and below.',
        flutterPackageRecommendation: ['device_calendar']
      },
      {
        id: 'reminders_full_access_ios',
        displayName: 'Reminders Full Access (iOS 17+)',
        platform: 'ios',
        category: 'contacts_calendar_reminders',
        iosKey: 'NSRemindersFullAccessUsageDescription',
        iosMinVersion: '17.0',
        defaultIosUsageDescription: 'This app requires full access to your reminders to view and manage tasks.',
        hint: 'Required on iOS 17.0+ to read, create, and manage reminders in the Reminders app.',
        flutterPackageRecommendation: ['device_calendar']
      }
    ]
  },
  {
    id: 'notifications_alarms',
    name: 'Notifications & Alarms',
    description: 'Push notifications, exact alarm scheduling, boot triggers, and haptic vibration.',
    icon: 'bell',
    permissions: [
      {
        id: 'post_notifications',
        displayName: 'Post Notifications (Android 13+)',
        platform: 'android',
        category: 'notifications_alarms',
        androidManifestName: 'android.permission.POST_NOTIFICATIONS',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 33,
        adbPermissionName: 'android.permission.POST_NOTIFICATIONS',
        hint: 'Required on Android 13+ (API 33+) to display local and push notifications. On earlier Android versions, notifications are enabled by default.',
        flutterPackageRecommendation: ['flutter_local_notifications', 'firebase_messaging', 'onesignal_flutter']
      },
      {
        id: 'vibrate',
        displayName: 'Vibrate / Haptics',
        platform: 'android',
        category: 'notifications_alarms',
        androidManifestName: 'android.permission.VIBRATE',
        androidProtectionLevel: 'normal',
        hint: 'Allows vibrating the device or triggering hardware haptic feedback motors.',
        flutterPackageRecommendation: ['vibration', 'flutter_vibrate']
      },
      {
        id: 'receive_boot_completed',
        displayName: 'Receive Boot Completed',
        platform: 'android',
        category: 'notifications_alarms',
        androidManifestName: 'android.permission.RECEIVE_BOOT_COMPLETED',
        androidProtectionLevel: 'normal',
        hint: 'Allows the app to automatically reschedule alarms, work tasks, or push tokens when the device finishes rebooting.',
        flutterPackageRecommendation: ['flutter_local_notifications', 'workmanager']
      },
      {
        id: 'schedule_exact_alarm',
        displayName: 'Schedule Exact Alarm (Android 12+)',
        platform: 'android',
        category: 'notifications_alarms',
        androidManifestName: 'android.permission.SCHEDULE_EXACT_ALARM',
        androidProtectionLevel: 'special',
        androidMinSdk: 31,
        hint: 'Allows scheduling alarms that execute at a precise second. Required for timer or calendar reminder apps on Android 12+ (API 31+).',
        storeReviewWarning: 'Google Play restricts SCHEDULE_EXACT_ALARM. Apps that are not alarm clocks, timers, or calendar apps may face rejection.',
        flutterPackageRecommendation: ['android_alarm_manager_plus', 'flutter_local_notifications']
      },
      {
        id: 'use_exact_alarm',
        displayName: 'Use Exact Alarm (Android 13+)',
        platform: 'android',
        category: 'notifications_alarms',
        androidManifestName: 'android.permission.USE_EXACT_ALARM',
        androidProtectionLevel: 'normal',
        androidMinSdk: 33,
        hint: 'Pre-granted exact alarm permission for certified alarm clock and timer apps on Android 13+ (API 33+).',
        storeReviewWarning: 'Google Play restricts USE_EXACT_ALARM solely to dedicated alarm clock and timer apps.',
        flutterPackageRecommendation: ['android_alarm_manager_plus']
      }
    ]
  },
  {
    id: 'biometrics_auth',
    name: 'Biometrics & Authentication',
    description: 'Fingerprint, Face ID, and system biometric authentication prompts.',
    icon: 'shield',
    permissions: [
      {
        id: 'biometrics',
        displayName: 'Biometrics & Face ID',
        platform: 'both',
        category: 'biometrics_auth',
        androidManifestName: 'android.permission.USE_BIOMETRIC',
        androidProtectionLevel: 'normal',
        androidMinSdk: 28,
        iosKey: 'NSFaceIDUsageDescription',
        defaultIosUsageDescription: 'This app uses Face ID / Touch ID for quick and secure authentication.',
        hint: 'Required to authenticate users using biometric hardware (Fingerprint, Face Unlock, or iOS Face ID). On iOS, NSFaceIDUsageDescription must describe why biometric authentication is used.',
        flutterPackageRecommendation: ['local_auth']
      },
      {
        id: 'use_fingerprint_legacy',
        displayName: 'Use Fingerprint (Legacy Android <= 8.1)',
        platform: 'android',
        category: 'biometrics_auth',
        androidManifestName: 'android.permission.USE_FINGERPRINT',
        androidProtectionLevel: 'normal',
        androidMaxSdk: 28,
        hint: 'Legacy fingerprint authentication permission on Android 8.1 and earlier (API <= 28). Deprecated in favor of USE_BIOMETRIC.',
        flutterPackageRecommendation: ['local_auth']
      }
    ]
  },
  {
    id: 'telephony_sms',
    name: 'Telephony & SMS',
    description: 'Phone call states, outbound calling, call log access, and SMS messaging.',
    icon: 'call-outgoing',
    permissions: [
      {
        id: 'read_phone_state',
        displayName: 'Read Phone State',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.READ_PHONE_STATE',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.READ_PHONE_STATE',
        hint: 'Allows read-only access to phone state, current cellular network info, phone number, and incoming call status.',
        storeReviewWarning: 'Google Play heavily scrutinizes READ_PHONE_STATE. Avoid using it just to obtain a unique device identifier; use advertising ID or app-instance GUID instead.',
        flutterPackageRecommendation: ['telephony', 'flutter_phone_state']
      },
      {
        id: 'call_phone',
        displayName: 'Initiate Phone Call',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.CALL_PHONE',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.CALL_PHONE',
        hint: 'Allows initiating a phone call directly without opening the system dialer UI. Most apps should use url_launcher with tel: scheme instead.',
        flutterPackageRecommendation: ['url_launcher', 'flutter_phone_direct_caller']
      },
      {
        id: 'read_call_log',
        displayName: 'Read Call Log',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.READ_CALL_LOG',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.READ_CALL_LOG',
        hint: 'Allows reading the device incoming, outgoing, and missed call history.',
        storeReviewWarning: 'Google Play strictly limits call log permissions to default dialer or default SMS handler apps. Third-party utility apps using this will face store rejection.',
        flutterPackageRecommendation: ['call_log']
      },
      {
        id: 'send_sms',
        displayName: 'Send SMS',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.SEND_SMS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.SEND_SMS',
        hint: 'Allows sending SMS messages directly in the background without user intervention.',
        storeReviewWarning: 'Google Play policy strictly restricts SEND_SMS to default SMS handling apps. Use url_launcher with sms: URI scheme instead for consumer apps.',
        flutterPackageRecommendation: ['telephony', 'flutter_sms']
      },
      {
        id: 'receive_sms',
        displayName: 'Receive SMS',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.RECEIVE_SMS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.RECEIVE_SMS',
        hint: 'Allows listening for and processing incoming SMS messages (e.g. for automatic SMS verification).',
        storeReviewWarning: 'Google Play restricts RECEIVE_SMS. For SMS OTP verification, use the Google SMS Retriever API or SMS User Consent API instead of RECEIVE_SMS.',
        flutterPackageRecommendation: ['telephony', 'sms_autofill']
      },
      {
        id: 'read_sms',
        displayName: 'Read SMS',
        platform: 'android',
        category: 'telephony_sms',
        androidManifestName: 'android.permission.READ_SMS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.READ_SMS',
        hint: 'Allows reading stored SMS messages from the device inbox and sent box.',
        storeReviewWarning: 'Google Play policy forbids READ_SMS unless the app is designated as the default SMS client on the user phone.',
        flutterPackageRecommendation: ['telephony']
      }
    ]
  },
  {
    id: 'background_performance',
    name: 'Background Services & Device Performance',
    description: 'Keep-awake locks, foreground services, and battery optimization exemptions.',
    icon: 'pulse',
    permissions: [
      {
        id: 'wake_lock',
        displayName: 'Wake Lock',
        platform: 'android',
        category: 'background_performance',
        androidManifestName: 'android.permission.WAKE_LOCK',
        androidProtectionLevel: 'normal',
        hint: 'Prevents the processor from sleeping or the screen from dimming during media playback or long computations.',
        flutterPackageRecommendation: ['wakelock_plus', 'keep_screen_on']
      },
      {
        id: 'foreground_service',
        displayName: 'Foreground Service',
        platform: 'android',
        category: 'background_performance',
        androidManifestName: 'android.permission.FOREGROUND_SERVICE',
        androidProtectionLevel: 'normal',
        androidMinSdk: 28,
        hint: 'Allows running foreground services with a persistent notification (e.g. audio playback, location tracking). On Android 14+, specific foregroundServiceType entries are also required in AndroidManifest.xml.',
        flutterPackageRecommendation: ['flutter_foreground_task', 'audio_service']
      },
      {
        id: 'ignore_battery_optimizations',
        displayName: 'Ignore Battery Optimizations',
        platform: 'android',
        category: 'background_performance',
        androidManifestName: 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        androidProtectionLevel: 'special',
        hint: 'Allows requesting exemption from Android Doze mode and App Standby power management.',
        storeReviewWarning: 'Google Play permits REQUEST_IGNORE_BATTERY_OPTIMIZATIONS only for apps whose core function is severely impacted by Doze (e.g. VoIP calling, health monitoring, task automation).',
        flutterPackageRecommendation: ['disable_battery_optimization', 'permission_handler']
      }
    ]
  },
  {
    id: 'sensors_health_system',
    name: 'Sensors, Health & System',
    description: 'Fitness tracking, HealthKit, App Tracking Transparency, Siri, system alerts, and package installer.',
    icon: 'heart',
    permissions: [
      {
        id: 'body_sensors',
        displayName: 'Body Sensors (Heart Rate / Pulse)',
        platform: 'android',
        category: 'sensors_health_system',
        androidManifestName: 'android.permission.BODY_SENSORS',
        androidProtectionLevel: 'dangerous',
        adbPermissionName: 'android.permission.BODY_SENSORS',
        hint: 'Allows accessing data from body sensors measuring biological vitals like heart rate or skin temperature.',
        flutterPackageRecommendation: ['health', 'permission_handler']
      },
      {
        id: 'body_sensors_background',
        displayName: 'Background Body Sensors (Android 13+)',
        platform: 'android',
        category: 'sensors_health_system',
        androidManifestName: 'android.permission.BODY_SENSORS_BACKGROUND',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 33,
        adbPermissionName: 'android.permission.BODY_SENSORS_BACKGROUND',
        hint: 'Allows accessing body sensor data while running in the background on Android 13+ (API 33+).',
        flutterPackageRecommendation: ['health', 'permission_handler']
      },
      {
        id: 'activity_recognition',
        displayName: 'Activity Recognition & Motion',
        platform: 'both',
        category: 'sensors_health_system',
        androidManifestName: 'android.permission.ACTIVITY_RECOGNITION',
        androidProtectionLevel: 'dangerous',
        androidMinSdk: 29,
        adbPermissionName: 'android.permission.ACTIVITY_RECOGNITION',
        iosKey: 'NSMotionUsageDescription',
        defaultIosUsageDescription: 'This app requires access to motion data to track physical activity and step count.',
        hint: 'Enables step counting, pedometer monitoring, and activity recognition (walking, biking, driving). On iOS, NSMotionUsageDescription is required for CoreMotion.',
        flutterPackageRecommendation: ['pedometer', 'activity_recognition_flutter']
      },
      {
        id: 'health_share_ios',
        displayName: 'Read Health Data / HealthKit (iOS)',
        platform: 'ios',
        category: 'sensors_health_system',
        iosKey: 'NSHealthShareUsageDescription',
        defaultIosUsageDescription: 'This app requires read access to health data to display your wellness metrics.',
        hint: 'Required on iOS to read workouts, steps, heart rate, and health metrics from Apple HealthKit.',
        storeReviewWarning: 'Apple HealthKit integration requires a dedicated privacy policy explaining that health data will never be sold to third-party data brokers or advertising platforms.',
        flutterPackageRecommendation: ['health']
      },
      {
        id: 'health_update_ios',
        displayName: 'Write Health Data / HealthKit (iOS)',
        platform: 'ios',
        category: 'sensors_health_system',
        iosKey: 'NSHealthUpdateUsageDescription',
        defaultIosUsageDescription: 'This app requires write access to health data to log workouts and activities.',
        hint: 'Required on iOS to write or update workouts, dietary intake, and body metrics into Apple HealthKit.',
        flutterPackageRecommendation: ['health']
      },
      {
        id: 'user_tracking_ios',
        displayName: 'App Tracking Transparency (iOS 14+)',
        platform: 'ios',
        category: 'sensors_health_system',
        iosKey: 'NSUserTrackingUsageDescription',
        iosMinVersion: '14.0',
        defaultIosUsageDescription: 'This identifier will be used to deliver personalized ads and content.',
        hint: 'Required on iOS 14+ when tracking users across third-party apps and websites for advertising purposes (IDFA).',
        storeReviewWarning: 'App Store review rejects apps that request tracking if the explanation in NSUserTrackingUsageDescription is vague, deceptive, or does not clearly state what data is tracked.',
        flutterPackageRecommendation: ['app_tracking_transparency']
      },
      {
        id: 'siri_ios',
        displayName: 'Siri Shortcuts (iOS)',
        platform: 'ios',
        category: 'sensors_health_system',
        iosKey: 'NSSiriUsageDescription',
        defaultIosUsageDescription: 'This app integrates with Siri to allow quick voice shortcuts and hands-free control.',
        hint: 'Required to expose in-app voice intents and shortcut actions to Apple Siri.',
        flutterPackageRecommendation: ['flutter_siri_suggestions']
      },
      {
        id: 'system_alert_window',
        displayName: 'Display Over Other Apps (System Alert Window)',
        platform: 'android',
        category: 'sensors_health_system',
        androidManifestName: 'android.permission.SYSTEM_ALERT_WINDOW',
        androidProtectionLevel: 'special',
        hint: 'Allows drawing floating windows or overlays on top of other running apps. Requires directing the user to Settings.',
        flutterPackageRecommendation: ['flutter_overlay_window', 'system_alert_window']
      },
      {
        id: 'request_install_packages',
        displayName: 'Request Install Packages',
        platform: 'android',
        category: 'sensors_health_system',
        androidManifestName: 'android.permission.REQUEST_INSTALL_PACKAGES',
        androidProtectionLevel: 'special',
        androidMinSdk: 26,
        hint: 'Allows an app to prompt the user to install APK files (e.g. self-updating APKs or enterprise app stores).',
        storeReviewWarning: 'Google Play restricts REQUEST_INSTALL_PACKAGES solely to apps whose primary purpose is application management. Apps using this for unauthorized in-app updates may be suspended.',
        flutterPackageRecommendation: ['ota_update', 'install_plugin']
      }
    ]
  }
];

export function getAllPermissionItems(): PermissionItem[] {
  return PERMISSION_CATALOG.flatMap(category => category.permissions);
}

export function findPermissionByAndroidName(androidManifestName: string): PermissionItem | undefined {
  return getAllPermissionItems().find(item => item.androidManifestName === androidManifestName);
}

export function findPermissionByIosKey(iosKey: string): PermissionItem | undefined {
  return getAllPermissionItems().find(item => item.iosKey === iosKey);
}

export interface PermissionCategorySummary {
  id: string;
  name: string;
  description: string;
  icon?: string;
  count: number;
}

export function getPermissionCategories(platform?: 'android' | 'ios' | 'all'): PermissionCategorySummary[] {
  return PERMISSION_CATALOG.map(category => {
    const matchingPermissions = category.permissions.filter(p => {
      if (!platform || platform === 'all') return true;
      if (platform === 'android') return p.platform === 'android' || p.platform === 'both';
      if (platform === 'ios') return (p.platform === 'ios' || p.platform === 'both') && typeof p.iosKey === 'string';
      return true;
    });
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      count: matchingPermissions.length
    };
  }).filter(c => c.count > 0);
}

