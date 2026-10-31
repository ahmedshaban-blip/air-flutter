// Compatibility Doctor Composite Module
window.AirFlutterCompatDoctorModule = class AirFlutterCompatDoctorModule {};

function mixinCompat(target, source) {
    if (!source || !source.prototype) return;
    for (const prop of Object.getOwnPropertyNames(source.prototype)) {
        if (prop !== 'constructor') {
            target.prototype[prop] = source.prototype[prop];
        }
    }
}

mixinCompat(window.AirFlutterCompatDoctorModule, window.AirFlutterCompatAuditModule);
mixinCompat(window.AirFlutterCompatDoctorModule, window.AirFlutterCompatConfigModule);
