const SET_READ_ONLY = 'scratch-gui/read-only/READ_ONLY';

const initialState = false;

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_READ_ONLY:
        return action.readOnly === true;
    default:
        return state;
    }
};
const setProjectReadOnly = flag => ({
    type: SET_READ_ONLY,
    readOnly: flag
});

export {
    reducer as default,
    initialState as projectReadOnlyInitialState,
    setProjectReadOnly
};
