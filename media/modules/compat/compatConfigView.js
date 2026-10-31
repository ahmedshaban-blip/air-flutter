// Compatibility Doctor - Configurator & Diff View Module
window.AirFlutterCompatConfigModule = class AirFlutterCompatConfigModule {
    populateVersionConfigurator(report, availableVersions, rules) {
        const versions = availableVersions || {
            agp: ["8.5.2", "8.4.2", "8.3.2", "8.2.2", "8.1.4", "8.0.2", "7.4.2"],
            gradle: ["8.7", "8.6", "8.5", "8.4", "8.2.1", "8.0.2", "7.6.4", "7.5"],
            kotlin: ["1.9.24", "1.9.10", "1.8.22", "1.7.20"],
            java: [17, 11],
            ios: ["13.0", "14.0", "15.0", "16.0", "17.0", "18.0", "12.0", "11.0"]
        };

        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const iosSelect = document.getElementById('configIosSelect');

        if (!agpSelect) return;

        // Fill AGP
        agpSelect.innerHTML = versions.agp.map(v => `<option value="${v}">${v}${v === '8.5.2' ? ' (Latest Verified)' : ''}</option>`).join('');
        const curAgp = report.gradle ? report.gradle.agpVersion : null;
        if (curAgp && versions.agp.includes(curAgp)) {
            agpSelect.value = curAgp;
        } else {
            agpSelect.value = '8.5.2';
        }

        // Fill Kotlin
        if (kotlinSelect) {
            kotlinSelect.innerHTML = versions.kotlin.map(v => `<option value="${v}">${v}</option>`).join('');
            const curKotlin = report.gradle ? report.gradle.kotlinVersion : null;
            if (curKotlin && versions.kotlin.includes(curKotlin)) {
                kotlinSelect.value = curKotlin;
            } else {
                kotlinSelect.value = '1.9.24';
            }
        }

        // Fill Java
        if (javaSelect) {
            javaSelect.innerHTML = versions.java.map(v => `<option value="${v}">JDK ${v} (source/target ${v})</option>`).join('');
            javaSelect.value = '17';
        }

        // Fill iOS
        if (iosSelect) {
            iosSelect.innerHTML = versions.ios.map(v => {
                const isDep = ['11.0', '12.0'].includes(v);
                return `<option value="${v}">iOS ${v}${isDep ? ' (Deprecated)' : (v === '13.0' ? ' (Recommended Min)' : '')}</option>`;
            }).join('');
            const curIos = report.podfile ? report.podfile.deploymentTarget : null;
            if (curIos && versions.ios.includes(curIos)) {
                iosSelect.value = curIos;
            } else {
                iosSelect.value = '13.0';
            }
        }

        // Trigger cascading logic
        this.onConfigAgpChanged();
    }

    onConfigAgpChanged() {
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        if (!agpSelect || !gradleSelect) return;

        const selectedAgp = agpSelect.value;
        const versions = this.compatAvailableVersions || {
            gradle: ["8.7", "8.6", "8.5", "8.4", "8.2.1", "8.0.2", "7.6.4", "7.5"]
        };

        // Find rule
        const rule = (this.compatRules || []).find(r => {
            const range = r.agpRange;
            if (selectedAgp.startsWith('8.5') && range.includes('8.5')) return true;
            if ((selectedAgp.startsWith('8.2') || selectedAgp.startsWith('8.3') || selectedAgp.startsWith('8.4')) && range.includes('8.2')) return true;
            if ((selectedAgp.startsWith('8.0') || selectedAgp.startsWith('8.1')) && range.includes('8.0')) return true;
            if (selectedAgp.startsWith('7.4') && range.includes('7.4')) return true;
            if (selectedAgp.startsWith('7.') && range.includes('7.0')) return true;
            return false;
        });

        // Smart Filter Gradle
        const isGradleCompatible = (gVer) => {
            if (!rule) return true;
            const expr = rule.compatibleGradle;
            if (expr.startsWith('>=8.7')) return parseFloat(gVer) >= 8.7;
            if (expr.includes('8.2') && expr.includes('8.7')) return parseFloat(gVer) >= 8.2 && parseFloat(gVer) <= 8.7;
            if (expr.includes('8.0') && expr.includes('8.4')) return parseFloat(gVer) >= 8.0 && parseFloat(gVer) <= 8.4;
            if (expr.includes('7.5') && expr.includes('7.6')) return parseFloat(gVer) >= 7.5 && parseFloat(gVer) <= 7.6;
            if (expr.includes('7.0') && expr.includes('7.4')) return parseFloat(gVer) >= 7.0 && parseFloat(gVer) <= 7.4;
            return true;
        };

        const currentGradle = gradleSelect.value;
        gradleSelect.innerHTML = versions.gradle.map(g => {
            const compat = isGradleCompatible(g);
            const isRec = rule && rule.recommendedGradle === g;
            return `<option value="${g}" ${compat ? '' : 'disabled'}>Gradle ${g}${isRec ? ' (Recommended for AGP ' + selectedAgp + ')' : (compat ? '' : ' (Incompatible)')}</option>`;
        }).join('');

        if (rule && rule.recommendedGradle) {
            if (!isGradleCompatible(currentGradle)) {
                gradleSelect.value = rule.recommendedGradle;
            } else {
                gradleSelect.value = currentGradle;
            }
        }

        // Auto-sync Java JDK baseline
        if (javaSelect && rule) {
            javaSelect.value = String(rule.minJava || 17);
        }

        // Auto-sync Kotlin if applicable
        if (kotlinSelect && rule && rule.recommendedKotlin) {
            kotlinSelect.value = rule.recommendedKotlin;
        }

        this.updateConfigStatusBanner();
    }

    updateConfigStatusBanner() {
        const banner = document.getElementById('configStatusBanner');
        const textEl = document.getElementById('configStatusText');
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');

        if (!banner || !textEl || !agpSelect || !gradleSelect) return;

        const agp = agpSelect.value;
        const gradle = gradleSelect.value;
        const java = javaSelect ? javaSelect.value : '17';
        const kotlin = kotlinSelect ? kotlinSelect.value : '1.9.24';

        banner.className = 'compat-status-card is-success';
        banner.style.padding = '10px 14px';
        banner.style.marginTop = '10px';
        textEl.innerHTML = `<strong>Verified Compatible Stack:</strong> AGP ${agp} &harr; Gradle ${gradle} &harr; JDK ${java} &harr; Kotlin ${kotlin}`;
    }

    prepareCustomStackDiffs() {
        const report = this.currentCompatReport;
        if (!report) {
            this.showToast('Please wait for scan results before customizing.', 'warning');
            return;
        }

        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const iosSelect = document.getElementById('configIosSelect');

        const targetAgp = agpSelect ? agpSelect.value : '';
        const targetGradle = gradleSelect ? gradleSelect.value : '';
        const targetKotlin = kotlinSelect ? kotlinSelect.value : '';
        const targetJava = javaSelect ? parseInt(javaSelect.value, 10) : 17;
        const targetIos = iosSelect ? iosSelect.value : '13.0';

        const diffs = [];

        // 1. Gradle Wrapper
        if (report.gradle && report.gradle.wrapperPath && report.gradle.gradleRange) {
            if (report.gradle.gradleVersion !== targetGradle) {
                diffs.push({
                    id: 'gradle',
                    title: 'Gradle Wrapper (gradle-wrapper.properties)',
                    filePath: report.gradle.wrapperPath,
                    current: report.gradle.gradleVersion || 'unknown',
                    target: targetGradle,
                    targetValue: targetGradle,
                    range: report.gradle.gradleRange
                });
            }
        }

        // 2. AGP
        if (report.gradle && report.gradle.buildGradlePath && report.gradle.agpRange) {
            if (report.gradle.agpVersion !== targetAgp) {
                diffs.push({
                    id: 'agp',
                    title: `AGP Version (${report.gradle.isKotlinDsl ? 'build.gradle.kts' : 'build.gradle'})`,
                    filePath: report.gradle.buildGradlePath,
                    current: report.gradle.agpVersion || 'unknown',
                    target: targetAgp,
                    targetValue: targetAgp,
                    range: report.gradle.agpRange
                });
            }
        }

        // 3. Kotlin
        if (report.gradle && report.gradle.buildGradlePath && report.gradle.kotlinRange && targetKotlin) {
            if (report.gradle.kotlinVersion !== targetKotlin) {
                diffs.push({
                    id: 'kotlin',
                    title: 'Kotlin Plugin Version',
                    filePath: report.gradle.buildGradlePath,
                    current: report.gradle.kotlinVersion || 'unknown',
                    target: targetKotlin,
                    targetValue: targetKotlin,
                    range: report.gradle.kotlinRange
                });
            }
        }

        // 4. Java / CompileOptions in app/build.gradle
        if (report.gradle && report.gradle.javaConfig && report.gradle.javaConfig.appBuildGradlePath) {
            const jc = report.gradle.javaConfig;
            const targetJavaVer = targetJava === 17 ? 'JavaVersion.VERSION_17' : 'JavaVersion.VERSION_11';
            const targetJvm = targetJava === 17 ? '17' : '11';

            if (jc.sourceCompatibilityRange && jc.sourceCompatibility && jc.sourceCompatibility !== targetJavaVer) {
                diffs.push({
                    id: 'javaSource',
                    title: 'sourceCompatibility (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.sourceCompatibility,
                    target: targetJavaVer,
                    targetValue: targetJavaVer,
                    range: jc.sourceCompatibilityRange
                });
            }

            if (jc.targetCompatibilityRange && jc.targetCompatibility && jc.targetCompatibility !== targetJavaVer) {
                diffs.push({
                    id: 'javaTarget',
                    title: 'targetCompatibility (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.targetCompatibility,
                    target: targetJavaVer,
                    targetValue: targetJavaVer,
                    range: jc.targetCompatibilityRange
                });
            }

            if (jc.jvmTargetRange && jc.jvmTarget && jc.jvmTarget !== targetJvm) {
                diffs.push({
                    id: 'jvmTarget',
                    title: 'kotlinOptions.jvmTarget (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.jvmTarget,
                    target: targetJvm,
                    targetValue: targetJvm,
                    range: jc.jvmTargetRange
                });
            }
        }

        // 5. iOS Target
        if (report.podfile && report.podfile.exists && report.podfile.podfilePath && report.podfile.targetRange && targetIos) {
            if (report.podfile.deploymentTarget !== targetIos) {
                diffs.push({
                    id: 'ios',
                    title: 'iOS Deployment Target (ios/Podfile)',
                    filePath: report.podfile.podfilePath,
                    current: report.podfile.deploymentTarget || 'unknown',
                    target: targetIos,
                    targetValue: targetIos,
                    range: report.podfile.targetRange
                });
            }
        }

        if (diffs.length === 0) {
            this.showToast('Project is already configured with this exact build stack!', 'info');
            return;
        }

        this.pendingDiffs = diffs;

        // Render diffs
        const diffListEl = document.getElementById('compatDiffList');
        if (diffListEl) {
            diffListEl.innerHTML = diffs.map(diff => `
                <div class="compat-diff-card">
                    <input type="checkbox" id="diff_${diff.id}" checked data-diff-id="${diff.id}" style="margin-top: 3px;" />
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">${diff.title}</div>
                        <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px; font-family: monospace;">${diff.filePath.split(/[\\\\/]/).slice(-2).join('/')}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="compat-diff-badge-old">${diff.current}</span>
                            <i class="fas fa-arrow-right" style="font-size: 10px; color: var(--muted);"></i>
                            <span class="compat-diff-badge-new">${diff.target}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const diffModal = document.getElementById('compatDiffModal');
        if (diffModal) {
            diffModal.hidden = false;
        }
    }
};
