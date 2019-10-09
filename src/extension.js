/* global imports */
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const { SwitchingToNonEmptyWorkspace } = Extension.imports['switching-to-non-empty-workspace'];

let switchingToNonEmptyWorkspace;

// eslint-disable-next-line no-unused-vars
function init() {}

// eslint-disable-next-line no-unused-vars
function enable() {
  switchingToNonEmptyWorkspace = new SwitchingToNonEmptyWorkspace();
}
// eslint-disable-next-line no-unused-vars
function disable() {
  switchingToNonEmptyWorkspace.destroy();
  switchingToNonEmptyWorkspace = null;
}
