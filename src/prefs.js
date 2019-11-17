/* global imports */
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const {
  SWITCH_TO_PREV_NON_EMPTY_WORKSPACE,
  SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE,
  WORKSPACE_WRAP_AROUND,
} = Extension.imports.constants;

const BINDING_ENABLED = 0;
const BINDING_ID = 1;
const BINDING_LABEL = 2;
const BINDING_MODS = 3;
const BINDING_KEY = 4;

class SettingsWidget {
  constructor(settings) {
    this._settings = settings;
    this._widget = this._createWidget();
    this._globalBindings = [];
  }

  getWidget() {
    return this._widget;
  }

  _createWidget() {
    const frame = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      border_width: 10,
      spacing: 10,
    });

    frame.add(this._buildSwitcher(WORKSPACE_WRAP_AROUND, 'Allow workspace wrap around in switcher'));
    frame.add(this._createBindingList([
      {
        key: SWITCH_TO_PREV_NON_EMPTY_WORKSPACE,
        labelText: 'Move to a non-empty workspace above',
      },
      {
        key: SWITCH_TO_NEXT_NON_EMPTY_WORKSPACE,
        labelText: 'Move to a non-empty workspace below',
      },
    ]));

    return frame;
  }

  _buildSwitcher(key, labelText) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 10,
    });
    const label = new Gtk.Label({
      label: labelText,
      xalign: 0,
    });
    const switcher = new Gtk.Switch({
      active: this._settings.get_boolean(key),
    });

    this._settings.bind(key, switcher, 'active', 3);

    box.pack_start(label, true, true, 0);
    box.add(switcher);

    return box;
  }

  _createBindingList(bindings) {
    this._model = new Gtk.ListStore();

    this._model.set_column_types([
      GObject.TYPE_BOOLEAN,
      GObject.TYPE_STRING,
      GObject.TYPE_STRING,
      GObject.TYPE_INT,
      GObject.TYPE_INT,
    ]);

    for (const { key, labelText } of bindings) {
      const enabled = this._settings.get_boolean(`${key}-enabled`);

      if (!enabled) {
        this._settings.set_strv(key, []);
      }

      let bindingKey = 0;
      let bindingMods = 0;
      const binding = this._settings.get_strv(key)[0];

      if (enabled && binding) {
        [bindingKey, bindingMods] = Gtk.accelerator_parse(binding);
      }

      this._model.set(
        this._model.append(),
        [BINDING_ENABLED, BINDING_ID, BINDING_LABEL, BINDING_MODS, BINDING_KEY],
        [enabled, key, labelText, bindingMods, bindingKey],
      );
    }

    const treeView = new Gtk.TreeView({
      expand: true,
      model: this._model,
      margin: 4,
      margin_top: 10,
    });

    // Enabled column
    const enabledCell = new Gtk.CellRendererToggle({
      radio: false,
      activatable: true,
    });

    const enabledColumn = new Gtk.TreeViewColumn({
      title: 'Enabled',
      expand: false,
    });

    enabledColumn.pack_start(enabledCell, true);
    enabledColumn.add_attribute(enabledCell, 'active', BINDING_ENABLED);

    enabledCell.connect('toggled', this._onToggleEnabled.bind(this));

    treeView.append_column(enabledColumn);

    // Action column
    const nameCell = new Gtk.CellRendererText();
    const nameColumn = new Gtk.TreeViewColumn({
      title: 'Action',
      expand: true,
    });

    nameColumn.pack_start(nameCell, true);
    nameColumn.add_attribute(nameCell, 'text', BINDING_LABEL);
    treeView.append_column(nameColumn);

    // keybinding column
    const keyBindingCell = new Gtk.CellRendererAccel({
      editable: true,
      'accel-mode': Gtk.CellRendererAccelMode.GTK,
    });

    keyBindingCell.connect('accel-edited', this._onEditedKeyboardBinding.bind(this, bindings));
    keyBindingCell.connect('accel-cleared', this._onClearedKeyboardBinding.bind(this));

    const keyBindingColumn = new Gtk.TreeViewColumn({ title: 'Modify' });

    keyBindingColumn.pack_end(keyBindingCell, false);
    keyBindingColumn.add_attribute(keyBindingCell, 'accel-mods', BINDING_MODS);
    keyBindingColumn.add_attribute(keyBindingCell, 'accel-key', BINDING_KEY);

    treeView.append_column(keyBindingColumn);

    return treeView;
  }

  _onToggleEnabled(toggle, iter) {
    const [success, iterator] = this._model.get_iter_from_string(iter);
    const value = !this._model.get_value(iterator, BINDING_ENABLED);

    if (!success) {
      throw new Error('Error toggled Keybinding');
    }

    this._model.set(iterator, [BINDING_ENABLED], [value]);
    toggle.set_active(value);

    const name = this._model.get_value(iterator, BINDING_ID);

    this._settings.set_boolean(`${name}-enabled`, value);

    // disable the keybinding
    if (!value) {
      this._model.set(iterator, [BINDING_MODS, BINDING_KEY], [0, 0]);
    }
  }

  _onEditedKeyboardBinding(bindings, rend, iter, key, mods) {
    const value = Gtk.accelerator_name(key, mods);
    const [success, iterator] = this._model.get_iter_from_string(iter);

    if (!success) {
      throw new Error('Error updating Keybinding');
    }

    const name = this._model.get_value(iterator, BINDING_ID);
    const existingBinding = this._keyboardBindingExists(bindings, name, value);

    if (existingBinding) {
      const dialog = new Gtk.MessageDialog({
        modal: true,
        message_type: Gtk.MessageType.WARNING,
        buttons: Gtk.ButtonsType.OK,
        title: 'Keyboard binding already defined',
        text: `The binding is already used by ${existingBinding}`,
      });

      dialog.run();
      dialog.destroy();

      return;
    }

    this._settings.set_boolean(`${name}-enabled`, true);
    this._settings.set_strv(name, [value]);

    this._model.set(iterator, [BINDING_ENABLED, BINDING_MODS, BINDING_KEY], [true, mods, key]);
  }

  _onClearedKeyboardBinding(rend, iter) {
    const [success, iterator] = this._model.get_iter_from_string(iter);

    if (!success) {
      throw new Error('Error clearing keybinding');
    }

    const name = this._model.get_value(iterator, BINDING_ID);

    this._settings.set_boolean(`${name}-enabled`, false);
    this._settings.set_strv(name, []);

    this._model.set(iterator, [BINDING_ENABLED, BINDING_MODS, BINDING_KEY], [false, 0, 0]);
  }

  _keyboardBindingExists(bindings, key, value) {
    const bindingKeys = bindings.map((binding) => binding.key);

    const bindingSource = 'PutWindow: ';
    // Compare with other extension settings
    const keys = this._settings.list_keys();
    for (let i = 0; i < keys.length; i++) {
      // Dont compare with our self
      if (keys[i] === key) {
        continue;
      }

      const bindingKey = this._settings.get_strv(keys[i]);

      if (bindingKeys.indexOf(key) !== -1 && Array.isArray(bindingKey) && bindingKey.includes(value)) {
        return bindingSource + keys[i];
      }
    }

    return this._globalKeyboardBindingExists(value);
  }

  _globalKeyboardBindingExists(value) {
    const globalBindings = this._loadGlobalBindings([
      {
        schema: 'org.gnome.desktop.wm.keybindings',
        text: 'GNOME Shell',
      },
      {
        schema: 'org.gnome.mutter.keybindings',
        text: 'Mutter',
      },
    ]);

    for (const { text, bindingsSettings } of globalBindings) {
      const bindingSource = `${text}: `;
      const keys = bindingsSettings.list_keys();

      for (let i = 0; i < keys.length; i++) {
        const bindingKey = bindingsSettings.get_strv(keys[i]);

        if (Array.isArray(bindingKey) && bindingKey.includes(value)) {
          return bindingSource + keys[i];
        }
      }
    }

    return false;
  }

  _loadGlobalBindings(globalBindings) {
    this._globalBindings = globalBindings.map(({ schema, text }) => {
      const currentBindings = this._globalBindings.find((globalBinding) => globalBinding.schema === schema);
      let bindingsSettings = null;

      if (!currentBindings || !currentBindings.settings) {
        bindingsSettings = new Gio.Settings({
          settings_schema: Gio.SettingsSchemaSource.get_default().lookup(schema, false),
        });
      }

      return {
        bindingsSettings,
        schema,
        text,
      };
    });

    return this._globalBindings;
  }
}

let settings;

// eslint-disable-next-line no-unused-vars
function init() {
  settings = ExtensionUtils.getSettings();
}

// eslint-disable-next-line no-unused-vars
function buildPrefsWidget() {
  const settingsWidget = new SettingsWidget(settings);
  const widget = settingsWidget.getWidget();

  widget.show_all();

  return widget;
}
