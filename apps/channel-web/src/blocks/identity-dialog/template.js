import { escapeHtml } from "../../shared/lib/helpers.js";

export const identityDialogTemplate = (vm) => `
    <div class="identity-dialog ${vm.open ? "is-open" : ""}">
        <div class="identity-dialog__backdrop" data-identity-action="close"></div>
        <div class="identity-dialog__panel">
            <header class="identity-dialog__header">
                <div class="identity-dialog__header-copy">
                    <h3>${escapeHtml(vm.title || "编辑频道身份")}</h3>
                </div>
                <button class="identity-dialog__ghost" data-identity-action="close" type="button">
                    <span class="material-icons-outlined">close</span>
                </button>
            </header>
            <div class="identity-dialog__body">
                <div class="identity-dialog__avatar-group">
                    <div class="identity-dialog__avatar-shell">
                        <img alt="${escapeHtml(vm.draftName || (vm.mode === "account" ? "账号头像" : "频道身份头像"))}" class="identity-dialog__avatar" data-ref="identity-avatar-preview" src="${vm.draftAvatar}" />
                        <label class="identity-dialog__avatar-trigger">
                            <span class="material-icons-outlined">photo_camera</span>
                            <input accept="image/*" class="sr-only" data-ref="identity-avatar-input" type="file" />
                        </label>
                    </div>
                </div>
                <label class="identity-dialog__field">
                    <span class="identity-dialog__inline-field">
                        <span class="identity-dialog__inline-label">昵称</span>
                        <input data-ref="identity-name-input" maxlength="12" type="text" value="${escapeHtml(vm.draftName)}" />
                        <span class="identity-dialog__count" data-ref="identity-name-count">${vm.nameCount}</span>
                    </span>
                </label>
                ${vm.error ? `<div class="identity-dialog__error">${escapeHtml(vm.error)}</div>` : ""}
            </div>
            <footer class="identity-dialog__footer">
                <button class="identity-dialog__secondary" data-identity-action="close" type="button">取消</button>
                <button class="identity-dialog__primary" data-identity-action="save" ${vm.canSave ? "" : "disabled"} type="button">${vm.saveStatus === "saving" ? "保存中" : "保存"}</button>
            </footer>
        </div>
    </div>
`;
