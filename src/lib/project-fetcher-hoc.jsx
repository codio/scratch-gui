import React from 'react';
import PropTypes from 'prop-types';
import {intlShape, injectIntl} from 'react-intl';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import VM from 'scratch-vm';
import Base64Util from './util/base64-util';

import {setProjectUnchanged} from '../reducers/project-changed';
import {setProjectReadOnly} from '../reducers/read-only';
import {
    defaultProjectId,
    LoadingStates,
    getIsCreatingNew,
    getIsFetchingWithId,
    getIsLoading,
    getIsShowingProject,
    onFetchedProjectData,
    projectError,
    setProjectId,
    onLoadedProject
} from '../reducers/project-state';
import {
    activateTab,
    BLOCKS_TAB_INDEX
} from '../reducers/editor-tab';

import log from './log';
import storage from './storage';

/* Higher Order Component to provide behavior for loading projects by id. If
 * there's no id, the default project is loaded.
 * @param {React.Component} WrappedComponent component to receive projectData prop
 * @returns {React.Component} component with project loading behavior
 */
const ProjectFetcherHOC = function (WrappedComponent) {
    class ProjectFetcherComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'fetchProject'
            ]);
            storage.setProjectHost(props.projectHost);
            storage.setAssetHost(props.assetHost);
            storage.setTranslatorFunction(props.intl.formatMessage);
            // props.projectId might be unset, in which case we use our default;
            // or it may be set by an even higher HOC, and passed to us.
            // Either way, we now know what the initial projectId should be, so
            // set it in the redux store.
            if (
                props.projectId !== '' &&
                props.projectId !== null &&
                typeof props.projectId !== 'undefined'
            ) {
                this.props.setProjectId(props.projectId.toString());
            }
        }
        componentWillMount () {
            const {codio} = window
            if (codio) {
                codio.loaded()
                    .then(() => {
                        codio.subscribeProjectUpdate(options =>
                            this.props.onProjectReadOnly(options.readOnly)
                        );
                    })
                    .fail(msg => {
                        /* eslint-disable-next-line no-console */
                        console.log(`codio loaded - error: ${msg}`);
                    });
            }
        }
        componentDidUpdate (prevProps) {
            if (prevProps.projectHost !== this.props.projectHost) {
                storage.setProjectHost(this.props.projectHost);
            }
            if (prevProps.assetHost !== this.props.assetHost) {
                storage.setAssetHost(this.props.assetHost);
            }

            if (this.props.isFetchingWithId && !prevProps.isFetchingWithId) {
                if (this.props.reduxProjectId === 'codio') {
                    this.fetchCodioProject(this.props.reduxProjectId, this.props.loadingState);
                } else {
                    this.fetchProject(this.props.reduxProjectId, this.props.loadingState);
                }
            }
            if (this.props.isShowingProject && !prevProps.isShowingProject) {
                this.props.onProjectUnchanged();
            }
            if (this.props.isShowingProject && (prevProps.isLoadingProject || prevProps.isCreatingNew)) {
                this.props.onActivateTab(BLOCKS_TAB_INDEX);
            }
        }
        loadCodioProject () {
            return new Promise((resolve, reject) => {
                const {codio} = window;
                if (codio) {
                    codio.loaded()
                        .then(() => {
                            const fileName = codio.getFileName();
                            if (typeof fileName !== 'string') {
                                const err = `vm loadCodioFile - non string codio file name "${fileName}"`
                                /* eslint-disable-next-line no-console */
                                console.log(err);
                                reject(new Error(err));
                                return;
                            }
                            const fileOptions = codio.getFileOptions();
                            window.codio.getBinaryFile(fileName)
                                .then(res => {
                                    if (res && res.content.length === 0) {
                                        reject(new Error('empty file'));
                                    } else {
                                        const uint8array = Base64Util.base64ToUint8Array(res.content);
                                        const view = uint8array.buffer;
                                        resolve({
                                            projectAsset: view,
                                            options: fileOptions
                                        });
                                    }
                                })
                                .fail(msg => {
                                    const err = `vm loadCodioFile - error loading scratch file: ${msg}`;
                                    /* eslint-disable-next-line no-console */
                                    console.log(err, msg);
                                    reject(new Error(err));
                                });
                        })
                        .fail(msg => {
                            const err = `vm codio loaded - error: ${msg}`;
                            /* eslint-disable-next-line no-console */
                            console.log(err);
                            reject(new Error(err));
                        });
                } else {
                    const err = 'vm no codio defined on window';
                    /* eslint-disable-next-line no-console */
                    console.log(err);
                    reject(new Error(err));
                }
            });
        }
        fetchCodioProject (projectId, loadingState) {
            return this.loadCodioProject(loadingState)
                .then(data => {
                    const {projectAsset, options} = data
                    if (projectAsset) {
                        this.props.onProjectReadOnly(options.readOnly);
                        this.props.onFetchedProjectData(projectAsset, loadingState);
                    } else {
                        // Treat failure to load as an error
                        // Throw to be caught by catch later on
                        throw new Error('Could not find project');
                    }
                })
                .catch(() => this.fetchProject(defaultProjectId, loadingState));
        }
        fetchProject (projectId, loadingState) {
            return storage
                .load(storage.AssetType.Project, projectId, storage.DataFormat.JSON)
                .then(projectAsset => {
                    if (projectAsset) {
                        this.props.onFetchedProjectData(projectAsset.data, loadingState);
                    } else {
                        // Treat failure to load as an error
                        // Throw to be caught by catch later on
                        throw new Error('Could not find project');
                    }
                })
                .catch(err => {
                    this.props.onError(err);
                    log.error(err);
                });
        }
        render () {
            const {
                /* eslint-disable no-unused-vars */
                assetHost,
                intl,
                isLoadingProject: isLoadingProjectProp,
                loadingState,
                onActivateTab,
                onError: onErrorProp,
                onFetchedProjectData: onFetchedProjectDataProp,
                onLoadingFinished: onLoadingFinishedProp,
                onProjectUnchanged,
                onProjectReadOnly,
                projectHost,
                projectId,
                reduxProjectId,
                setProjectId: setProjectIdProp,
                /* eslint-enable no-unused-vars */
                isFetchingWithId: isFetchingWithIdProp,
                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    fetchingProject={isFetchingWithIdProp}
                    {...componentProps}
                />
            );
        }
    }
    ProjectFetcherComponent.propTypes = {
        assetHost: PropTypes.string,
        canSave: PropTypes.bool,
        intl: intlShape.isRequired,
        isCreatingNew: PropTypes.bool,
        isFetchingWithId: PropTypes.bool,
        isLoadingProject: PropTypes.bool,
        isShowingProject: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        onLoadingFinished: PropTypes.func,
        onActivateTab: PropTypes.func,
        onError: PropTypes.func,
        onFetchedProjectData: PropTypes.func,
        onProjectUnchanged: PropTypes.func,
        onProjectReadOnly: PropTypes.func,
        projectHost: PropTypes.string,
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        reduxProjectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        setProjectId: PropTypes.func,
        vm: PropTypes.instanceOf(VM).isRequired
    };
    ProjectFetcherComponent.defaultProps = {
        assetHost: 'https://assets.scratch.mit.edu',
        projectHost: 'https://projects.scratch.mit.edu'
    };

    const mapStateToProps = state => ({
        isCreatingNew: getIsCreatingNew(state.scratchGui.projectState.loadingState),
        isFetchingWithId: getIsFetchingWithId(state.scratchGui.projectState.loadingState),
        isLoadingProject: getIsLoading(state.scratchGui.projectState.loadingState),
        isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
        loadingState: state.scratchGui.projectState.loadingState,
        reduxProjectId: state.scratchGui.projectState.projectId,
        vm: state.scratchGui.vm
    });
    const mapDispatchToProps = (dispatch, ownProps) => ({
        onActivateTab: tab => dispatch(activateTab(tab)),
        onError: error => dispatch(projectError(error)),
        onFetchedProjectData: (projectData, loadingState) =>
            dispatch(onFetchedProjectData(projectData, loadingState)),
        onLoadingFinished: (loadingState, success) =>
            dispatch(onLoadedProject(loadingState, ownProps.canSave, success)),
        setProjectId: projectId => dispatch(setProjectId(projectId)),
        onProjectUnchanged: () => dispatch(setProjectUnchanged()),
        onProjectReadOnly: readOnly => dispatch(setProjectReadOnly(readOnly))
    });
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(ProjectFetcherComponent));
};

export {
    ProjectFetcherHOC as default
};
