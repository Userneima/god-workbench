import "./styles.css";
import { attachIdentityDialogEvents } from "./events.js";
import { selectIdentityDialogVM } from "./selectors.js";
import { identityDialogTemplate } from "./template.js";

export const mountIdentityDialogBlock = ({ root, store, actions }) => {
    let refs = null;
    let previousVM = null;
    let hasBoundEvents = false;
    let isComposing = false;

    const ensureRefs = () => {
        refs = {
            nameInput: root.querySelector("[data-ref='identity-name-input']"),
            nameCount: root.querySelector("[data-ref='identity-name-count']"),
            avatarPreview: root.querySelector("[data-ref='identity-avatar-preview']"),
            saveButton: root.querySelector("[data-identity-action='save']")
        };
        if (!hasBoundEvents) {
            attachIdentityDialogEvents({ root, actions });
            root.addEventListener("compositionstart", (event) => {
                if (event.target.closest("[data-ref='identity-name-input']")) {
                    isComposing = true;
                }
            });
            root.addEventListener("compositionend", () => {
                isComposing = false;
            });
            hasBoundEvents = true;
        }
    };

    const shouldRerender = (vm) => {
        if (!previousVM || root.innerHTML === "") {
            return true;
        }

        return previousVM.open !== vm.open
            || previousVM.error !== vm.error
            || previousVM.saveStatus !== vm.saveStatus
            || previousVM.draftAvatar !== vm.draftAvatar;
    };

    return {
        render() {
            const vm = selectIdentityDialogVM(store.getState());
            const shouldRefocus = refs?.nameInput && document.activeElement === refs.nameInput;

            if (shouldRerender(vm)) {
                root.innerHTML = identityDialogTemplate(vm);
                ensureRefs();

                if (shouldRefocus && refs?.nameInput) {
                    refs.nameInput.focus();
                    refs.nameInput.setSelectionRange(vm.draftName.length, vm.draftName.length);
                }
                previousVM = vm;
                return;
            }

            if (refs?.avatarPreview) {
                refs.avatarPreview.src = vm.draftAvatar;
                refs.avatarPreview.alt = vm.draftName || (vm.mode === "account" ? "账号头像" : "频道身份头像");
            }

            if (refs?.nameCount) {
                refs.nameCount.textContent = vm.nameCount;
            }

            if (refs?.saveButton) {
                refs.saveButton.disabled = !vm.canSave;
                refs.saveButton.textContent = vm.saveStatus === "saving" ? "保存中" : "保存";
            }

            if (refs?.nameInput && document.activeElement !== refs.nameInput && !isComposing) {
                refs.nameInput.value = vm.draftName;
            }

            previousVM = vm;
        }
    };
};
