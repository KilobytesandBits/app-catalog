(function () {
    var Ext = window.Ext4 || window.Ext;

    /**
     * Iteration Tracking Board App
     * The Iteration Tracking Board can be used to visualize and manage your User Stories and Defects within an Iteration.
     */
    Ext.define('Rally.apps.iterationtrackingboard.IterationTrackingBoardApp', {
        extend: 'Rally.app.TimeboxScopedApp',
        requires: [
            'Rally.data.Ranker',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.grid.TreeGrid',
            'Rally.data.wsapi.TreeStoreBuilder',
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.cardboard.plugin.Print',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardOwnerFilter',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.gridboard.plugin.GridBoardArtifactTypeChooser',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.gridboard.plugin.GridBoardFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardToggleable',
            'Rally.ui.grid.plugin.TreeGridExpandedRowPersistence',
            'Rally.ui.gridboard.plugin.GridBoardExpandAll',
            'Rally.ui.gridboard.plugin.GridBoardCustomView',
            'Rally.ui.filter.view.ModelFilter',
            'Rally.ui.filter.view.OwnerFilter',
            'Rally.ui.filter.view.OwnerPillFilter',
            'Rally.ui.filter.view.TagPillFilter',
            'Rally.app.Message',
            'Rally.apps.iterationtrackingboard.Column',
            'Rally.clientmetrics.ClientMetricsRecordable',
            'Rally.apps.iterationtrackingboard.StatsBanner'
        ],

        mixins: [
            'Rally.app.CardFieldSelectable',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        componentCls: 'iterationtrackingboard',
        alias: 'widget.rallyiterationtrackingboard',

        settingsScope: 'project',
        scopeType: 'iteration',
        autoScroll: false,

        config: {
            defaultSettings: {
                showCardAge: true,
                cardAgeThreshold: 3
            }
        },

        modelNames: ['User Story', 'Defect', 'Defect Suite', 'Test Set'],

        onScopeChange: function(scope) {
            if(!this.rendered) {
                this.on('afterrender', this.onScopeChange, this, {single: true});
                return;
            }
            this._addStatsBanner();
            this._getGridStore().then({
                success: function(gridStore) {
                    var model = gridStore.model;
                    if(_.isFunction(model.getArtifactComponentModels)) {
                        this.modelNames = _.intersection(_.pluck(gridStore.model.getArtifactComponentModels(),'displayName'),this.modelNames);
                    } else {
                        this.modelNames = [model.displayName];
                    }
                    this._addGridBoard(gridStore);
                },
                scope: this
            });
        },

        getSettingsFields: function () {
            var fields = this.callParent(arguments);

            fields.push({
                type: 'cardage',
                config: {
                    margin: '0 0 0 80',
                    width: 300
                }
            });

            return fields;
        },

        _getGridStore: function() {
            var context = this.getContext(),
                config = {
                    models: this.modelNames,
                    autoLoad: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE') ? false : true,
                    remoteSort: true,
                    root: {expanded: true},
                    filters: [context.getTimeboxScope().getQueryFilter()],
                    enableHierarchy: true
                };

            return Ext.create('Rally.data.wsapi.TreeStoreBuilder').build(config);
        },

        _addStatsBanner: function() {
           this.remove('statsBanner');
           this.add({
                xtype: 'statsbanner',
                itemId: 'statsBanner',
                context: this.getContext(),
                margin: '0 0 5px 0'
            });
        },

        _addGridBoard: function (gridStore) {
            var context = this.getContext();

            this.remove('gridBoard');

            this.gridboard = this.add({
                itemId: 'gridBoard',
                xtype: 'rallygridboard',
                stateId: 'iterationtracking-gridboard',
                context: context,
                plugins: this._getGridBoardPlugins(),
                modelNames: this.modelNames,
                cardBoardConfig: {
                    serverSideFiltering: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                    plugins: [
                        {ptype: 'rallycardboardprinting', pluginId: 'print'},
                        {ptype: 'rallyfixedheadercardboard'}
                    ],
                    storeConfig: {
                        useShallowFetch: true
                    },
                    columnConfig: {
                        xtype: 'iterationtrackingboardcolumn',
                        additionalFetchFields: ['PortfolioItem'],
                        enableInfiniteScroll: this.getContext().isFeatureEnabled('S64257_ENABLE_INFINITE_SCROLL_ALL_BOARDS'),
                        plugins: [{
                            ptype: 'rallycolumnpolicy',
                            app: this
                        }]
                    },
                    cardConfig: {
                        showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1
                    },
                    listeners: {
                        filter: this._onBoardFilter,
                        filtercomplete: this._onBoardFilterComplete
                    }
                },
                gridConfig: this._getGridConfig(gridStore),
                addNewPluginConfig: {
                    style: {
                        'float': 'left'
                    }
                },
                listeners: {
                    load: this._onLoad,
                    toggle: this._onToggle,
                    recordupdate: this._publishContentUpdatedNoDashboardLayout,
                    recordcreate: this._publishContentUpdatedNoDashboardLayout,
                    scope: this
                },
                height: this._getAvailableGridBoardHeight()
            });
        },

        _getAvailableGridBoardHeight: function() {
            return this.getHeight() - this.down('#statsBanner').getHeight();
        },

        _getGridBoardPlugins: function() {
            var plugins = ['rallygridboardaddnew'],
                context = this.getContext();

            if (context.isFeatureEnabled('EXPAND_ALL_TREE_GRID_CHILDREN')) {
                plugins.push('rallygridboardexpandall');
            }

            if (context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE')) {
                plugins.push({
                    ptype: 'rallygridboardfiltercontrol',
                    filterControlConfig: {
                        cls: 'small gridboard-filter-control',
                        margin: '3 10 3 7',
                        stateful: true,
                        stateId: context.getScopedStateId('iteration-tracking-filter-button'),
                        items: [
                            this._createOwnerFilterItem(context),
                            this._createTagFilterItem(context),
                            this._createModelFilterItem(context)
                        ]
                    }
                });
            } else {
                plugins.push('rallygridboardownerfilter');
            }

            plugins.push('rallygridboardtoggleable');
            var alwaysSelectedValues = ['FormattedID', 'Name', 'Owner'];
            if (context.getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled) {
                alwaysSelectedValues.push('DragAndDropRank');
            }

            if (!context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE')) {
                plugins.push({
                    ptype: 'rallygridboardfilterinfo',
                    isGloballyScoped: Ext.isEmpty(this.getSetting('project')) ? true : false,
                    stateId: 'iteration-tracking-owner-filter-' + this.getAppId()
                });
            }

            plugins.push({
                ptype: 'rallygridboardfieldpicker',
                headerPosition: 'left',
                gridFieldBlackList: [
                    'ObjectID',
                    'Description',
                    'DisplayColor',
                    'Notes',
                    'Subscription',
                    'Workspace',
                    'Changesets',
                    'RevisionHistory',
                    'Children'
                ],
                boardFieldBlackList: [
                    'ObjectID',
                    'Description',
                    'DisplayColor',
                    'Notes',
                    'Rank',
                    'DragAndDropRank',
                    'Subscription',
                    'Workspace',
                    'Changesets',
                    'RevisionHistory',
                    'PortfolioItemType',
                    'StateChangedDate',
                    'Children'
                ],
                alwaysSelectedValues: alwaysSelectedValues,
                modelNames: this.modelNames,
                boardFieldDefaults: (this.getSetting('cardFields') && this.getSetting('cardFields').split(',')) ||
                    ['Parent', 'Tasks', 'Defects', 'Discussion', 'PlanEstimate']
            });

            if (context.isFeatureEnabled('ITERATION_TRACKING_CUSTOM_VIEWS')) {
                plugins.push(this._getCustomViewConfig());
            }

            return plugins;
        },

        setSize: Ext.Function.createBuffered(function() {
            this.superclass.setSize.apply(this, arguments);
            if(this.gridboard && this.gridboard.getHeight() !== this._getAvailableGridBoardHeight()) {
                this.gridboard.setHeight(this._getAvailableGridBoardHeight());
            }
        }, 100),

        _getCustomViewConfig: function() {
            var customViewConfig = {
                ptype: 'rallygridboardcustomview',
                stateId: 'iteration-tracking-board-app',

                defaultGridViews: [{
                    model: ['UserStory', 'Defect', 'DefectSuite'],
                    name: 'Defect Status',
                    state: {
                        cmpState: {
                            expandAfterApply: true,
                            columns: [
                                'Name',
                                'State',
                                'Discussion',
                                'Priority',
                                'Severity',
                                'FoundIn',
                                'FixedIn',
                                'Owner'
                            ]
                        },
                        filterState: {
                            filter: {
                                defectstatusview: {
                                    isActiveFilter: false,
                                    itemId: 'defectstatusview',
                                    queryString: '((Defects.ObjectID != null) OR (Priority != null))'
                                }
                            }
                        }
                    }
                }, {
                    model: ['UserStory', 'Defect', 'TestSet', 'DefectSuite'],
                    name: 'Task Status',
                    state: {
                        cmpState: {
                            expandAfterApply: true,
                            columns: [
                                'Name',
                                'State',
                                'PlanEstimate',
                                'TaskEstimate',
                                'ToDo',
                                'Discussions',
                                'Owner'
                            ]
                        },
                        filterState: {
                            filter: {
                                taskstatusview: {
                                    isActiveFilter: false,
                                    itemId: 'taskstatusview',
                                    queryString: '(Tasks.ObjectID != null)'
                                }
                            }
                        }
                    }
                }, {
                    model: ['UserStory', 'Defect', 'TestSet'],
                    name: 'Test Status',
                    state: {
                        cmpState: {
                            expandAfterApply: true,
                            columns: [
                                'Name',
                                'State',
                                'Discussions',
                                'LastVerdict',
                                'LastBuild',
                                'LastRun',
                                'ActiveDefects',
                                'Priority',
                                'Owner'
                            ]
                        },
                        filterState: {
                            filter: {
                                teststatusview: {
                                    isActiveFilter: false,
                                    itemId: 'teststatusview',
                                    queryString: '(TestCases.ObjectID != null)'
                                }
                            }
                        }
                    }
                }]
            };

            customViewConfig.defaultBoardViews = _.cloneDeep(customViewConfig.defaultGridViews);
            _.each(customViewConfig.defaultBoardViews, function(view) {
                delete view.state.cmpState;
            });

            return customViewConfig;
        },

        _createOwnerFilterItem: function (context) {
            var isPillPickerEnabled = context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                projectRef = context.getProjectRef();

            if (isPillPickerEnabled) {
                return {
                    xtype: 'rallyownerpillfilter',
                    margin: '-15 0 5 0',
                    filterChildren: this.getContext().isFeatureEnabled('S58650_ALLOW_WSAPI_TRAVERSAL_FILTER_FOR_MULTIPLE_TYPES'),
                    project: projectRef,
                    showPills: false,
                    showClear: true
                };
            } else {
                return {
                    xtype: 'rallyownerfilter',
                    margin: '5 0 5 0',
                    filterChildren: this.getContext().isFeatureEnabled('S58650_ALLOW_WSAPI_TRAVERSAL_FILTER_FOR_MULTIPLE_TYPES'),
                    project: projectRef
                };
            }

        },

        _createTagFilterItem: function (context) {
            var filterUiImprovementsToggleEnabled = context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE');
            return {
                xtype: 'rallytagpillfilter',
                margin: filterUiImprovementsToggleEnabled ? '-15 0 5 0' : '5 0 5 0',
                showPills: filterUiImprovementsToggleEnabled,
                showClear: filterUiImprovementsToggleEnabled,
                remoteFilter: filterUiImprovementsToggleEnabled
            };
        },

        _createModelFilterItem: function (context) {
            return {
                xtype: 'rallymodelfilter',
                models: this.modelNames,
                context: context
            };
        },

        _getGridConfig: function (gridStore) {
            var context = this.getContext(),
                stateString = 'iteration-tracking-treegrid',
                stateId = context.getScopedStateId(stateString);

            var gridConfig = {
                xtype: 'rallytreegrid',
                store: gridStore,
                enableRanking: this.getContext().getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled,
                columnCfgs: null, //must set this to null to offset default behaviors in the gridboard
                defaultColumnCfgs: this._getGridColumns(),
                showSummary: true,
                summaryColumns: this._getSummaryColumnConfig(),
                treeColumnRenderer: function (value, metaData, record, rowIdx, colIdx, store, view) {
                    store = store.treeStore || store;
                    return Rally.ui.renderer.RendererFactory.getRenderTemplate(store.model.getField('FormattedID')).apply(record.data);
                },
                enableBulkEdit: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                plugins: [],
                stateId: stateId,
                stateful: true,
                pageResetMessages: [Rally.app.Message.timeboxScopeChange]
            };

            if (context.isFeatureEnabled('EXPAND_ALL_TREE_GRID_CHILDREN')) {
                gridConfig.plugins.push('rallytreegridexpandedrowpersistence');
            }

            return gridConfig;
        },

        _getSummaryColumnConfig: function () {
            var taskUnitName = this.getContext().getWorkspace().WorkspaceConfiguration.TaskUnitName,
                planEstimateUnitName = this.getContext().getWorkspace().WorkspaceConfiguration.IterationEstimateUnitName;

            return [
                {
                    field: 'PlanEstimate',
                    type: 'sum',
                    units: planEstimateUnitName
                },
                {
                    field: 'TaskEstimateTotal',
                    type: 'sum',
                    units: taskUnitName
                },
                {
                    field: 'TaskRemainingTotal',
                    type: 'sum',
                    units: taskUnitName
                }
            ];
        },

        _getGridColumns: function (columns) {
            var result = ['FormattedID', 'Name', 'ScheduleState', 'Blocked', 'PlanEstimate', 'TaskStatus', 'TaskEstimateTotal', 'TaskRemainingTotal', 'Owner', 'DefectStatus', 'Discussion'];

            if (columns) {
                result = columns;
            }
            _.pull(result, 'FormattedID');

            return result;
        },

        _onLoad: function () {
            this._publishContentUpdated();
            this.recordComponentReady();
        },

        _onBoardFilter: function () {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function () {
            this.setLoading(false);
        },

        _onToggle: function (toggleState) {
            var appEl = this.getEl();

            if (toggleState === 'board') {
                appEl.replaceCls('grid-toggled', 'board-toggled');
            } else {
                appEl.replaceCls('board-toggled', 'grid-toggled');
            }
            this._publishContentUpdated();
        },

        _publishContentUpdated: function () {
            this.fireEvent('contentupdated');
        },

        _publishContentUpdatedNoDashboardLayout: function () {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        }
    });
})();
