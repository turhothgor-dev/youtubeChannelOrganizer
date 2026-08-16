const YouTubeGroupsStorage = (() => {
    const STORAGE_KEY = "youtubeGroups";
    let groupsInitializationPromise = null;

    async function getGroups() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const data = stored[STORAGE_KEY];

    if (!data || !Array.isArray(data.groups)) {
        if (!groupsInitializationPromise) {
        const emptyGroups = [];
        groupsInitializationPromise = saveGroups(emptyGroups)
            .then(() => emptyGroups)
            .finally(() => {
            groupsInitializationPromise = null;
            });
        }

        return groupsInitializationPromise;
    }

    return data.groups;
    }

    async function saveGroups(groups) {
    if (!Array.isArray(groups)) {
        throw new TypeError("Los grupos deben ser un array.");
    }

    await browser.storage.local.set({
        [STORAGE_KEY]: {
        version: 1,
        groups
        }
    });
    }

    return {
        getGroups,
        saveGroups
    };
})();