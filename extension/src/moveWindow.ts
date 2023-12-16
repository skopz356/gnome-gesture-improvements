import Clutter from '@gi-types/clutter';
import Meta from '@gi-types/meta';
import Shell from '@gi-types/shell';
import { global, imports } from 'gnome-shell';
import { createSwipeTracker, TouchpadSwipeGesture } from './swipeTracker';


const Main = imports.ui.main;

const {SwipeTracker} = imports.ui.swipeTracker;


export class MoveWindowExtension implements ISubExtension {
	private _swipeTracker: typeof SwipeTracker.prototype;
	private _connectors: number[] = [];
	private _progress = 0;
	private _touchpadSwipeGesture: typeof TouchpadSwipeGesture.prototype;

	constructor() {
		this._swipeTracker = createSwipeTracker(
			global.stage,
			[4],
			Shell.ActionMode.NORMAL,
			Clutter.Orientation.VERTICAL,
			true,
			1,
			{allowTouch: false},
		);

		this._swipeTracker.allowLongSwipes = true;
		this._touchpadSwipeGesture = this._swipeTracker._touchpadGesture as typeof TouchpadSwipeGesture.prototype;

		console.debug('enabling extension');
	}

	apply(): void {
		this._swipeTracker.orientation = Clutter.Orientation.VERTICAL;
		this._connectors.push(this._swipeTracker.connect('begin', this._gestureBegin.bind(this)));
		this._connectors.push(this._swipeTracker.connect('update', this._gestureUpdate.bind(this)));
		this._connectors.push(this._swipeTracker.connect('end', this._gestureEnd.bind(this)));
	}

	destroy(): void {
		this._connectors.forEach(connector => this._swipeTracker.disconnect(connector));
		this._swipeTracker.destroy();
	}

	private _getWindowToMove(monitor: number) {
		const types = [Meta.WindowType.MODAL_DIALOG, Meta.WindowType.NORMAL, Meta.WindowType.DIALOG];
		log(`window ${global.display.get_focus_window()}`);

		const window = global.display.get_focus_window() as Meta.Window | null;
		if (
			window &&
            !window.is_fullscreen() &&
            types.includes(window.get_window_type()) &&
            // ignore window is it's skipbar and type is normal
            (!window.skip_taskbar || window.get_window_type() !== Meta.WindowType.NORMAL) &&
            window.get_monitor() === monitor &&
            !window.is_always_on_all_workspaces() &&
            (!Meta.prefs_get_workspaces_only_on_primary() || monitor === Main.layoutManager.primaryMonitor.index)
		)
			return window;
		return undefined;
	}

	_moveWindowTo(workspaceIndex: number): void {
		const window = this._getWindowToMove(global.display.get_current_monitor());
		if (window) {
			window.change_workspace_by_index(workspaceIndex, false);
			const workspace = global.workspaceManager.get_workspace_by_index(workspaceIndex);
			log(`workspace ${workspace}`);
			if(workspace) {
				workspace.activate_with_focus(window, global.get_current_time());
			}
		}
	}

	_gestureBegin(tracker: typeof SwipeTracker.prototype, _progress: number): void {
		tracker.confirmSwipe(
			global.screen_width,
			[-1, 0, 1],
			0,
			0,
		);
	}

	_gestureUpdate(_tracker: never, progress: number): void {
		const index = global.workspaceManager.get_active_workspace_index();
		log(`index ${index}`);
		if(progress === 1) {
			this._moveWindowTo(index + 1);
		}else {
			this._moveWindowTo(index - 1);
		}
	}

	_gestureEnd(_tracker: never, _progress: number): void {
		log('finished');
	}
}
