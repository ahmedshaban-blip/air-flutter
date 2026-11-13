// Air Flutter — Modal access layer.
//
// Every feature module opens its modal the same way: `modal.hidden = false`.
// Rather than reach into twenty modules, this controller watches the
// `.modal-backdrop` elements and applies the behaviours the panel was missing:
//
//   - dialog semantics (role="dialog" aria-modal aria-labelledby) on open
//   - focus moved into the card, and returned to the opener on close
//   - Tab / Shift+Tab trapped inside the card while it is open
//   - Escape closes the topmost modal
//   - the shell content behind the scrim is marked inert / aria-hidden
//
// Modals stack: some flows open a second dialog (a diff view, a companion
// guide) over the first. The shell is only un-inerted when the whole stack
// empties, so assistive tech never reaches obscured background controls.
//
// It is additive: markup keeps its ids and message keys, and a modal that
// already declares its own dialog role is left as-is.
(function () {
    const FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    // Dialog containers across the codebase. The main panel modals use
    // `.modal-backdrop`; a few older feature surfaces use their own overlay
    // class. All of them deserve the same access behaviour.
    const DIALOG_SELECTOR = '.modal-backdrop, .asset-modal-overlay, .is-convert-backdrop';

    // The content box inside a dialog, across the three dialog families.
    const DIALOG_CARD_SELECTOR = '.modal-card, .asset-modal-content, .is-convert-dialog';

    window.AirFlutterModalController = class AirFlutterModalController {
        initModalController() {
            if (this.modalControllerReady) return;
            this.modalControllerReady = true;
            this.modalOpeners = new WeakMap();
            this.modalStack = [];

            document.querySelectorAll(DIALOG_SELECTOR).forEach(modal => this.watchModal(modal));

            // Modals are composed at load, but tabs and modules can inject more,
            // so keep watching for new dialog containers appearing anywhere.
            // Note: the main backdrops are children of `.ff-shell`; watching the
            // body also catches overlays a module may append elsewhere.
            this.modalObserver = new MutationObserver(records => {
                records.forEach(record => {
                    record.addedNodes.forEach(node => {
                        if (!node || node.nodeType !== 1) return;
                        if (node.matches && node.matches(DIALOG_SELECTOR)) {
                            this.watchModal(node);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll(DIALOG_SELECTOR).forEach(m => this.watchModal(m));
                        }
                    });
                });
            });
            this.modalObserver.observe(document.body, { childList: true, subtree: true });

            document.addEventListener('keydown', event => this.onModalKeydown(event), true);
        }

        watchModal(modal) {
            if (!modal || modal.dataset.modalWatched === 'true') return;
            modal.dataset.modalWatched = 'true';

            // Clicking the scrim closes this modal.
            modal.addEventListener('mousedown', event => {
                if (event.target === modal) this.closeModal(modal);
            });

            const observer = new MutationObserver(() => {
                if (modal.hidden) {
                    this.onModalHidden(modal);
                } else {
                    this.onModalShown(modal);
                }
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });

            if (!modal.hidden) this.onModalShown(modal);
        }

        onModalShown(modal) {
            if (this.modalStack.indexOf(modal) === -1) {
                // Record whatever had focus the moment this modal opened, so it
                // can be handed back when the modal closes.
                const opener = document.activeElement;
                if (opener && opener !== document.body && typeof opener.focus === 'function') {
                    this.modalOpeners.set(modal, opener);
                }
                this.modalStack.push(modal);
            }

            const card = modal.querySelector(DIALOG_CARD_SELECTOR) || modal;
            this.decorateDialog(card);
            this.markShellInert(true);

            // Mark every lower modal aria-hidden so only the top one is exposed.
            this.modalStack.forEach((m, index) => {
                const isTop = index === this.modalStack.length - 1;
                const c = m.querySelector(DIALOG_CARD_SELECTOR) || m;
                if (isTop) {
                    c.removeAttribute('aria-hidden');
                } else {
                    c.setAttribute('aria-hidden', 'true');
                }
            });

            // Focus the first sensible control, or the card itself.
            const target = this.firstFocusable(card) || card;
            if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
            try {
                target.focus({ preventScroll: false });
            } catch (e) {
                target.focus();
            }
        }

        onModalHidden(modal) {
            const index = this.modalStack.indexOf(modal);
            if (index === -1) return;
            this.modalStack.splice(index, 1);

            // Only re-expose the shell once the whole stack has closed.
            if (this.modalStack.length === 0) {
                this.markShellInert(false);
            } else {
                // The next modal down becomes the exposed region again.
                const next = this.modalStack[this.modalStack.length - 1];
                const card = next.querySelector(DIALOG_CARD_SELECTOR) || next;
                card.removeAttribute('aria-hidden');
            }

            this.restoreOpenerFocus(modal);
        }

        decorateDialog(card) {
            if (!card.getAttribute('role')) card.setAttribute('role', 'dialog');
            card.setAttribute('aria-modal', 'true');

            if (!card.getAttribute('aria-labelledby')) {
                const heading = card.querySelector('.modal-head h2, .modal-head h3, h2, h3');
                if (heading) {
                    if (!heading.id) heading.id = 'af-modal-title-' + Math.random().toString(36).slice(2, 8);
                    card.setAttribute('aria-labelledby', heading.id);
                } else if (!card.getAttribute('aria-label')) {
                    card.setAttribute('aria-label', 'Dialog');
                }
            }
        }

        firstFocusable(container) {
            const nodes = Array.from(container.querySelectorAll(FOCUSABLE)).filter(node => {
                if (node.hasAttribute('hidden') || node.disabled) return false;
                if (node.getAttribute('aria-hidden') === 'true') return false;
                return node.offsetParent !== null || node === document.activeElement;
            });
            return nodes[0] || null;
        }

        focusable(container) {
            return Array.from(container.querySelectorAll(FOCUSABLE)).filter(node => {
                if (node.hasAttribute('hidden') || node.disabled) return false;
                if (node.getAttribute('aria-hidden') === 'true') return false;
                return node.offsetParent !== null;
            });
        }

        onModalKeydown(event) {
            const modal = this.modalStack[this.modalStack.length - 1];
            if (!modal) return;
            const card = modal.querySelector(DIALOG_CARD_SELECTOR) || modal;

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeModal(modal);
                return;
            }

            if (event.key === 'Tab') {
                const items = this.focusable(card);
                if (!items.length) {
                    event.preventDefault();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                const active = document.activeElement;

                if (event.shiftKey && (active === first || !card.contains(active))) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (active === last || !card.contains(active))) {
                    event.preventDefault();
                    first.focus();
                }
            }
        }

        closeModal(modal) {
            // Let the owning module observe the change by toggling `hidden`,
            // which is the contract every module already listens to.
            modal.hidden = true;
        }

        // True when `container` holds a dialog that is currently open (its
        // `hidden` attribute is absent). A stair of dialogs can be nested inside
        // one another, so this walks every match, not just the first.
        hasOpenDialog(container) {
            return Array.from(container.querySelectorAll(DIALOG_SELECTOR)).some(dialog => !dialog.hidden);
        }

        markShellInert(inert) {
            const shell = document.querySelector('.ff-shell') || document.body;
            // Dialogs are siblings of the shell content, so inert the shell's
            // own children while keeping the open dialog exposed.
            if (inert) {
                this.modalBackgroundNodes = Array.from(shell.children).filter(node => {
                    if (node.matches && node.matches(DIALOG_SELECTOR)) return false;
                    // Keep live regions exposed so long-operation status and
                    // toasts are still announced while a dialog is open.
                    if (node.matches && node.matches('[role="status"], [role="alert"], [aria-live]')) return false;
                    // Some dialogs (the Icon & Splash convert modal, asset
                    // import, localization modals) are nested INSIDE a tab view
                    // rather than being direct children of the shell. Inerting
                    // their ancestor would inert the open dialog's own subtree
                    // and swallow every click inside it, so a shell child that
                    // holds an OPEN dialog is left interactive.
                    if (node.querySelector && this.hasOpenDialog(node)) return false;
                    return true;
                });
                this.modalBackgroundNodes.forEach(node => {
                    node.setAttribute('aria-hidden', 'true');
                    node.setAttribute('inert', '');
                });
            } else {
                (this.modalBackgroundNodes || []).forEach(node => {
                    node.removeAttribute('aria-hidden');
                    node.removeAttribute('inert');
                });
                this.modalBackgroundNodes = [];
            }
        }

        restoreOpenerFocus(modal) {
            const opener = this.modalOpeners.get(modal);
            this.modalOpeners.delete(modal);

            // If another modal is still open, focus belongs to it.
            if (this.modalStack.length > 0) return;

            if (opener && document.contains(opener) && !opener.disabled && opener.offsetParent !== null) {
                try {
                    opener.focus();
                    return;
                } catch (e) { /* fall through to the anchor */ }
            }

            // The opener is gone (re-rendered away) — fall back to a stable anchor.
            const anchor = document.querySelector('.ff-jump-input, .ff-tab.is-active');
            if (anchor && anchor.focus) anchor.focus();
        }
    };
})();
