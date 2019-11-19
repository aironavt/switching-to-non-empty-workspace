/* global imports */
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const {
  SWITCH_TO_PREV_NON_EMPTY_WORKSPACE,
  SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE,
  WORKSPACE_WRAP_AROUND,
} = Extension.imports.constants;

const motionDirection = {
  PREV_WORKSPACE: 'prev',
  NEXT_WORKSPACE: 'next',
};

// eslint-disable-next-line no-unused-vars
class SwitchingToNonEmptyWorkspace {
  constructor() {
    this._isWorkspaceWrapAround = false;
    this._settings = ExtensionUtils.getSettings();
    this._originGetNeighbor = Meta.Workspace.prototype.get_neighbor;

    this._addKeyBinding(SWITCH_TO_PREV_NON_EMPTY_WORKSPACE, this._onSwitchToPrevNoEmptyWorkspace);
    this._addKeyBinding(SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE, this._onSwitchToNextNoEmptyWorkspace);
    this._onWorkspaceWrapAroundChanged();
    this._settingsWorkspaceWrapAround = this._settings.connect(
      `changed::${WORKSPACE_WRAP_AROUND}`,
      this._onWorkspaceWrapAroundChanged.bind(this),
    );
    this._toggleNeighborHandler();
  }

  destroy() {
    Meta.Workspace.prototype.get_neighbor = this._originGetNeighbor;
    Main.wm.removeKeybinding(SWITCH_TO_PREV_NON_EMPTY_WORKSPACE);
    Main.wm.removeKeybinding(SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE);
    this._settings.disconnect(this._settingsWorkspaceWrapAround);
  }

  _onSwitchToPrevNoEmptyWorkspace() {
    this._switchWorkspace(motionDirection.PREV_WORKSPACE);
  }

  _onSwitchToNextNoEmptyWorkspace() {
    this._switchWorkspace(motionDirection.NEXT_WORKSPACE);
  }

  _addKeyBinding(event, callback) {
    Main.wm.addKeybinding(
      event,
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      callback.bind(this),
    );
  }

  _onWorkspaceWrapAroundChanged() {
    this._isWorkspaceWrapAround = this._settings.get_boolean(WORKSPACE_WRAP_AROUND);
    this._toggleNeighborHandler();
  }

  _toggleNeighborHandler() {
    Meta.Workspace.prototype.get_neighbor = this._isWorkspaceWrapAround
      ? this._getNeighbor.bind(this)
      : this._originGetNeighbor;
  }

  _switchWorkspace(direction) {
    const activeWorkspaceIndex = this._getActiveWorkspaceIndex();
    const workspaceIndex = this._getNextWorkspace(activeWorkspaceIndex, direction);

    if (workspaceIndex !== undefined) {
      this._actionWorkspaceByIndex(workspaceIndex);
    }
  }

  _getNeighbor(direction) {
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

    let list = this._createList(
      activeWorkspaceIndex,
      this._getWorkspaceNumber(),
      direction,
    );

    if (!this._isWorkspaceWrapAround) {
      const directionFilter = direction === motionDirection.NEXT_WORKSPACE
        ? (index) => index >= activeWorkspaceIndex
        : (index) => index <= activeWorkspaceIndex;

      list = list.filter(directionFilter);
    }

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

  _createList(firstIndex, length, direction) {
    const list = [];
    const directionInc = direction === motionDirection.NEXT_WORKSPACE ? 1 : -1;

    for (let index = 1; index <= length; index++) {
      let nextIndex = firstIndex + (index * directionInc);

      if (nextIndex < 0 || nextIndex >= length) {
        nextIndex -= (length * directionInc);
      }

      list.push(nextIndex);
    }

    return list;
  }

  _actionWorkspaceByIndex(index) {
    Main.wm.actionMoveWorkspace(this._getWorkspaceByIndex(index));
  }
}
