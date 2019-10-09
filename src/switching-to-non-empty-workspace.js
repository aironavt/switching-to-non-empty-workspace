/* global imports */
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const ExtensionUtils = imports.misc.extensionUtils;

const SWITCH_TO_PREV_NON_EMPTY_WORKSPACE = 'switch-to-prev-non-empty-workspace';
const SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE = 'switch-to-next-non-empty-workspace';
const motionDirection = {
  PREV_WORKSPACE: 'prev',
  NEXT_WORKSPACE: 'next',
};

// eslint-disable-next-line no-unused-vars
class SwitchingToNonEmptyWorkspace {
  constructor() {
    this.initialize();
  }

  initialize() {
    this.settings = ExtensionUtils.getSettings();
    this.originGetNeighbor = Meta.Workspace.prototype.get_neighbor;

    Meta.Workspace.prototype.get_neighbor = this.getNeighbor.bind(this);

    this._addKeyBinding(SWITCH_TO_PREV_NON_EMPTY_WORKSPACE, this.switchToPrevNoEmptyWorkspace);
    this._addKeyBinding(SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE, this.switchToNextNoEmptyWorkspace);
  }

  destroy() {
    Meta.Workspace.prototype.get_neighbor = this.originGetNeighbor;
    Main.wm.removeKeybinding(SWITCH_TO_PREV_NON_EMPTY_WORKSPACE);
    Main.wm.removeKeybinding(SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE);
  }

  switchToPrevNoEmptyWorkspace() {
    this._switchWorkspace(motionDirection.PREV_WORKSPACE);
  }

  switchToNextNoEmptyWorkspace() {
    this._switchWorkspace(motionDirection.NEXT_WORKSPACE);
  }

  _addKeyBinding(event, callback) {
    Main.wm.addKeybinding(
      event,
      this.settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      callback.bind(this),
    );
  }

  _switchWorkspace(direction) {
    const activeWorkspaceIndex = this._getActiveWorkspaceIndex();
    const workspaceIndex = this._getNextWorkspace(activeWorkspaceIndex, direction);

    if (workspaceIndex !== undefined) {
      this._actionWorkspaceByIndex(workspaceIndex);
    }
  }

  getNeighbor(direction) {
    let activeWorkspaceIndex = this._getActiveWorkspaceIndex();

    if (this._getWorkspaceNumber() >= 2) {
      activeWorkspaceIndex = (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT)
        ? this._getPrevWorkspaceIndex(activeWorkspaceIndex)
        : this._getNextWorkspaceIndex(activeWorkspaceIndex);
    }

    return this._getWorkspaceByIndex(activeWorkspaceIndex);
  }

  _getPrevWorkspaceIndex(activeWorkspaceIndex) {
    return activeWorkspaceIndex > 0 ? activeWorkspaceIndex - 1 : this._getLastWorkspaceIndex();
  }

  _getNextWorkspaceIndex(activeWorkspaceIndex) {
    return activeWorkspaceIndex < this._getLastWorkspaceIndex() ? activeWorkspaceIndex + 1 : 0;
  }

  _getNextWorkspace(activeWorkspaceIndex, direction) {
    if (this._getWorkspaceNumber() < 2) {
      return;
    }

    const list = this._createList(
      activeWorkspaceIndex,
      this._getWorkspaceNumber(),
      direction,
    );

    return list.find((index) => this._getWorkspaceByIndex(index).list_windows().length);
  }

  _getWorkspaceNumber() {
    return global.workspace_manager.n_workspaces;
  }

  _getLastWorkspaceIndex() {
    return this._getWorkspaceNumber() - 1;
  }

  _getWorkspaceByIndex(index) {
    return global.workspace_manager.get_workspace_by_index(index);
  }

  _getActiveWorkspaceIndex() {
    return global.workspace_manager.get_active_workspace_index();
  }

  /**
   *
   * @param {int} firstIndex
   * @param {int} length
   * @param {motionDirection} direction
   * @returns {[]}
   * @private
   */
  _createList(firstIndex, length, direction) {
    const list = [];
    const p = direction === motionDirection.NEXT_WORKSPACE ? 1 : -1;

    for (let index = 1; index <= length; index++) {
      let nextIndex = firstIndex + (index * p);

      if (nextIndex < 0 || nextIndex >= length) {
        nextIndex -= (length * p);
      }

      list.push(nextIndex);
    }

    return list;
  }

  _actionWorkspaceByIndex(index) {
    Main.wm.actionMoveWorkspace(this._getWorkspaceByIndex(index));
  }
}
