const AuthState = {
    users: [],
    needsUnlock: false,
    selectedUserId: null,
    pinAttempts: 0,
    isSearchModalOpen: false,
    init: async function() {
        try {
            this.selectedUserId = null;
            this.pinAttempts = 0;
            this.isSearchModalOpen = false;
            if (window.electronAPI) {
                const res = await window.electronAPI.getUsersList();
                if (res && res.needsUnlock) {
                    this.needsUnlock = true;
                } else if (res && res.users) {
                    this.users = res.users;
                }
            }
        } catch (_) {}
    },
    getSortedUsers: function() {
        try {
            const lastId = localStorage.getItem('lastLoggedInUserId');
            return [...this.users].sort((a, b) => {
                try {
                    if (a.id === lastId) return -1;
                    if (b.id === lastId) return 1;
                    const timeA = Number(a.last_login) || 0;
                    const timeB = Number(b.last_login) || 0;
                    return timeB - timeA;
                } catch (_) { return 0; }
            });
        } catch (_) {
            return this.users;
        }
    },
    selectUser: function(id) {
        try {
            this.selectedUserId = id;
            this.pinAttempts = 0;
            this.isSearchModalOpen = false;
        } catch (_) {}
    }
};
export default AuthState;
