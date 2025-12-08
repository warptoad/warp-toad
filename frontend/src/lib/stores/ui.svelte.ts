const ACTIVE_TAB_KEY = 'warptoad:activeTab';

type TabValue = 'bridge' | 'withdraw';

// Load active tab from localStorage
function loadActiveTab(): TabValue {
	if (typeof window === 'undefined') return 'bridge';
	
	const stored = localStorage.getItem(ACTIVE_TAB_KEY);
	if (stored === 'bridge' || stored === 'withdraw') {
		return stored;
	}
	return 'bridge';
}

// Save active tab to localStorage
function saveActiveTab(tab: TabValue) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

// Create reactive UI state
class UIStore {
	private _activeTab = $state<TabValue>(loadActiveTab());

	get activeTab(): TabValue {
		return this._activeTab;
	}

	set activeTab(value: TabValue) {
		this._activeTab = value;
		saveActiveTab(value);
	}
}

export const uiStore = new UIStore();
