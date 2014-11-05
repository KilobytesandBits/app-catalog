(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.kanban.KanbanApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.apps.kanban.Settings',
            'Rally.apps.kanban.Column',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',

            'Rally.ui.gridboard.plugin.BoardPolicyDisplayable',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.cardboard.PolicyContainer',
            'Rally.ui.cardboard.CardBoard',
            'Rally.ui.cardboard.plugin.Scrollable',
            'Rally.ui.report.StandardReport',
            'Rally.clientmetrics.ClientMetricsRecordable',
            'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.ui.cardboard.plugin.FixedHeader'
        ],
        mixins: [
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        cls: 'kanban',
        alias: 'widget.kanbanapp',
        appName: 'Kanban',

        settingsScope: 'project',

        items: [
			{
				xtype: 'container',
				itemId: 'slaContainer'
			},
            {
                xtype: 'container',
                itemId: 'bodyContainer'
            }
        ],
        autoScroll: false,
        layout: 'fit',
        config: {
            defaultSettings: {
                groupByField: 'ScheduleState',
                showRows: false,
                columns: Ext.JSON.encode({
                    Defined: {wip: ''},
                    'In-Progress': {wip: ''},
                    Completed: {wip: ''},
                    Accepted: {wip: ''}
                }),
                cardFields: 'FormattedID,Name,Owner,Discussion,Tasks,Defects', //remove with COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS
                hideReleasedCards: false,
                showCardAge: true,
                cardAgeThreshold: 3,
                excludeWeekendsFromSLA: true,
                showSLA: false,
                pageSize: 25
            }
        },

        launch: function() {

            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: this._onStoryModelRetrieved,
                scope: this
            });
        },

        getOptions: function() {
            return [
                {
                    text: 'Show Cycle Time Report',
                    handler: this._showCycleTimeReport,
                    scope: this
                },
                {
                    text: 'Show Throughput Report',
                    handler: this._showThroughputReport,
                    scope: this
                },
                {
                    text: 'Print',
                    handler: this._print,
                    scope: this
                }
            ];
        },

        getSettingsFields: function() {
            return Rally.apps.kanban.Settings.getFields({
                shouldShowColumnLevelFieldPicker: this._shouldShowColumnLevelFieldPicker(),
                defaultCardFields: this.getSetting('cardFields')
            });
        },

        /**
         * Called when any timebox scope change is received.
         * @protected
         * @param {Rally.app.TimeboxScope} timeboxScope The new scope
         */
        onTimeboxScopeChange: function(timeboxScope) {
            this.callParent(arguments);
            this.gridboard.destroy();
            this.launch();
        },

        _shouldShowSwimLanes: function() {
            return true;//this.getContext().isFeatureEnabled('F5684_KANBAN_SWIM_LANES');
        },

        _shouldShowColumnLevelFieldPicker: function() {
            return this.getContext().isFeatureEnabled('COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS');
        },

        _onStoryModelRetrieved: function(model) {
            this.groupByField = model.getField(this.getSetting('groupByField'));
            this._addCardboardContent();
        },

        _addCardboardContent: function() {
            var cardboardConfig = this._getCardboardConfig();

            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                cardboardConfig.columns = this._getColumnConfig(columnSetting);
            }

			//show team SLA on board
			if (this.getSetting('sla') && this.getSetting('showSLA')) {
				var slaPanel = Ext.create('Ext.form.Panel', {
					items: [{
						xtype: 'label',
						text: 'Team Service Level Agreement: ' + this.getSetting('sla') + ' days',
						cls: 'sla'
					}]
				});
			
				this.down('#slaContainer').add(slaPanel);
			}

			this.gridboard = this.down('#bodyContainer').add(this._getGridboardConfig(cardboardConfig));

            this.cardboard = this.gridboard.getGridOrBoard();
        },

        _getGridboardConfig: function(cardboardConfig) {
            var context = this.getContext(),
                modelNames = this._getDefaultTypes();
            return {
                xtype: 'rallygridboard',
                stateful: false,
                toggleState: 'board',
                cardBoardConfig: cardboardConfig,
                shouldDestroyTreeStore: this.getContext().isFeatureEnabled('S73617_GRIDBOARD_SHOULD_DESTROY_TREESTORE'),
                plugins: [
                    'rallygridboardaddnew',
                    {
                        ptype: 'rallygridboardcustomfiltercontrol',
                        filterChildren: true,
                        filterControlConfig: {
                            blackListFields: [],
                            whiteListFields: [],
                            context: context,
                            margin: '3 9 3 30',
                            modelNames: modelNames,
                            stateful: true,
                            stateId: context.getScopedStateId('kanban-custom-filter-button')
                        }
                    },
                    {
                        ptype: 'rallygridboardfieldpicker',
                        headerPosition: 'left',
                        boardFieldBlackList: ['Successors', 'Predecessors', 'DisplayColor'],
                        modelNames: modelNames,
                        boardFieldDefaults: this.getSetting('cardFields').split(',')
                    },

                    {
                        ptype: 'rallyboardpolicydisplayable',
                        prefKey: 'kanbanAgreementsChecked',
                        checkboxConfig: {
                            boxLabel: 'Show Agreements'
                        }
                    }
                ],
                context: context,
                modelNames: modelNames,
                addNewPluginConfig: {
                    listeners: {
                        beforecreate: this._onBeforeCreate,
                        beforeeditorshow: this._onBeforeEditorShow,
                        scope: this
                    },
                    style: {
                        'float': 'left'
                    }
                },
                storeConfig: {
                    filters: this._getFilters()
                },
                height: this.getHeight()
            };
        },

        _getColumnConfig: function(columnSetting) {
            var columns = [];
            Ext.Object.each(columnSetting, function(column, values) {
                var columnConfig = {
                    xtype: 'kanbancolumn',
                    enableWipLimit: true,
                    wipLimit: values.wip,
                    plugins: [{
                        ptype: 'rallycolumnpolicy',
                        app: this
                    }],

                    value: column,
                    columnHeaderConfig: {
                        headerTpl: column || 'None'
                    },

                    listeners: {
                        invalidfilter: {
                            fn: this._onInvalidFilter,
                            scope: this
                        }
                    }
                };
                if(this._shouldShowColumnLevelFieldPicker()) {
                    columnConfig.fields = this._getFieldsForColumn(values);
                }
                columns.push(columnConfig);
            }, this);

            columns[columns.length - 1].storeConfig = {
                filters: this._getLastColumnFilter()
            };

            return columns;
        },

        _getFieldsForColumn: function(values) {
            var columnFields = [];
            if (this._shouldShowColumnLevelFieldPicker()) {
                if (values.cardFields) {
                    columnFields = values.cardFields.split(',');
                } else if (this.getSetting('cardFields')) {
                    columnFields = this.getSetting('cardFields').split(',');
                }
            }
            return columnFields;
        },

        _onInvalidFilter: function() {
            Rally.ui.notify.Notifier.showError({
                message: 'Invalid query: ' + this.getSetting('query')
            });
        },

        _getCardboardConfig: function() {
            var config = {
                xtype: 'rallycardboard',
                plugins: [
                    {ptype: 'rallycardboardprinting', pluginId: 'print'},
                    {
                        ptype: 'rallyscrollablecardboard',
                        containerEl: this.getEl()
                    },
                    {ptype: 'rallyfixedheadercardboard'}
                ],
                types: this._getDefaultTypes(),
                attribute: this.getSetting('groupByField'),
                margin: '10px',
                context: this.getContext(),
                listeners: {
                    beforecarddroppedsave: this._onBeforeCardSaved,
                    load: this._onBoardLoad,
                    cardupdated: this._publishContentUpdatedNoDashboardLayout,
                    scope: this
                },
                columnConfig: {
                    xtype: 'rallycardboardcolumn',
                    enableWipLimit: true
                },
                cardConfig: {
                    editable: true,
                    showIconMenus: true,
                    showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1,
                    showBlockedReason: true,
                    listeners: {
                        afterrender: this._showCardSLA,
                        rerender: this._showCardSLA,
                        scope: this

                    }
                },

                storeConfig: {
                    context: this.getContext().getDataContext(),
                    fetch: ["InProgressDate", "ScheduleState"]
                }
            };
            if (this.getSetting('showRows')) {
                Ext.merge(config, {
                    rowConfig: {
                        field: this.getSetting('rowsField'),
                        sortDirection: 'ASC'
                    }
                });
            }
            return config;
        },
		
		//Show Service Level Agreement status for a card (if configured to show)
		_showCardSLA: function(card) {
			var inProgressDate, daysInProgress, serviceLevelAgreement, remainingDaysForSLA, toolTipText, slaText, today;
			
			serviceLevelAgreement = this.getSetting('sla');
			
			//SLA has not been set
			if (!serviceLevelAgreement) {
				return;
			}
			
			inProgressDate = card.record.get('InProgressDate');
			today = new Date();
			
			//if the card is not in progress or is done, don't calculate SLA
			if (!inProgressDate || (card.record.get('ScheduleState') === 'Accepted')) {
				return;
			}
			
			//get number of days in progress
			daysInProgress = this._getNumberOfWorkDaysWithinRange(inProgressDate, today);
			
			//if we have a service level agreement that is at least 0, calculate SLA
			if (serviceLevelAgreement >= 0) {
				var statusContent, statusField, content, statusValue;

				statusContent = card.el.query('.status-content')[0];
				statusField = document.createElement('div');
				statusField.className = 'field-content status-field';

				statusValue = document.createElement('div');
				statusValue.className = 'status-value age';
				//statusValue.title = toolTipText;

				content = document.createElement('span');
			
				remainingDaysForSLA = (serviceLevelAgreement - daysInProgress);

				//no more days remaining
				if (remainingDaysForSLA === 0) {
					slaText = 'Due Today';
					//toolTipText = slaText + ' <br/> In Progress for'  + daysInProgress + ' days. <br/> Started: ' + inProgressDate;
				}
				//violating the SLA
				else if (remainingDaysForSLA < 0) {
					slaText = 'Past Due by ' + Math.abs(remainingDaysForSLA) + ' days';
					statusValue.className = 'status-value age sla-violation';
					//toolTipText = slaText + ' <br/> In Progress for ' + daysInProgress + ' days. <br/> Started: ' + inProgressDate;
				}
				//days left before SLA
				else {
					slaText = 'Due in ' + remainingDaysForSLA + ' days';
					//toolTipText = slaText + ' <br/> In Progress for ' + daysInProgress + ' days. <br/> Started: ' + inProgressDate;
				}
				content.appendChild(document.createTextNode(slaText));

				statusValue.appendChild(content);
				statusField.appendChild(statusValue);
				statusContent.appendChild(statusField);
			}
        },

		//calculate the number of days in progress; if excluding weekends, only Mon-Fri will be included in the calculation
		_getNumberOfWorkDaysWithinRange: function(startDate, endDate) {
			var numberOfDays = 0, includeWeekends = this.getSetting('excludeWeekendsFromSLA') === false;
			var start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            var end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                       
			while (start < end) {
				if (includeWeekends || (start.getDay() > 0 && start.getDay() < 6)) {
					numberOfDays++;
				}
				start.setDate(start.getDate()+1); 
			}

			return numberOfDays;
		},
		
        _getFilters: function() {
            var filters = [];
            if(this.getSetting('query')) {
                filters.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
            }
            if(this.getContext().getTimeboxScope()) {
                filters.push(this.getContext().getTimeboxScope().getQueryFilter());
            }
            return filters;
        },
		
		
        _getLastColumnFilter: function() {
            return this.getSetting('hideReleasedCards') ?
                [
                    {
                        property: 'Release',
                        value: null
                    }
                ] : [];
        },

        _getColumnSetting: function() {
            var columnSetting = this.getSetting('columns');
            return columnSetting && Ext.JSON.decode(columnSetting);
        },

        _buildReportConfig: function(report) {

            var reportConfig = {
                report: report,
                work_items: this._getWorkItemTypesForChart()
            };
            if (this.getSetting('groupByField') !== 'ScheduleState') {
                reportConfig.filter_field = this.groupByField.displayName;
            }
            return reportConfig;
        },

        _showCycleTimeReport: function() {
            this._showReportDialog('Cycle Time Report',
                this._buildReportConfig(Rally.ui.report.StandardReport.Reports.CycleLeadTime));
        },

        _showThroughputReport: function() {
            this._showReportDialog('Throughput Report',
                this._buildReportConfig(Rally.ui.report.StandardReport.Reports.Throughput));
        },

        _print: function() {
            this.gridboard.getGridOrBoard().openPrintPage({title: 'Kanban Board'});
        },

        _getWorkItemTypesForChart: function() {
            var types = this.gridboard.getGridOrBoard().getTypes(),
                typeMap = {
                    hierarchicalrequirement: 'G',
                    defect: 'D'
                };
            return types.length === 2 ? 'N' : typeMap[types[0]];
        },

        _getDefaultTypes: function() {
            return ['User Story', 'Defect'];
        },

        _buildStandardReportConfig: function(reportConfig) {
            var scope = this.getContext().getDataContext();
            return {
                xtype: 'rallystandardreport',
                padding: 10,
                project: scope.project,
                projectScopeUp: scope.projectScopeUp,
                projectScopeDown: scope.projectScopeDown,
                reportConfig: reportConfig
            };
        },

        _showReportDialog: function(title, reportConfig) {
            var height = 450, width = 600;
            this.getEl().mask();
            Ext.create('Rally.ui.dialog.Dialog', {
                title: title,
                autoShow: true,
                draggable: false,
                closable: true,
                modal: false,
                height: height,
                width: width,
                items: [
                    Ext.apply(this._buildStandardReportConfig(reportConfig),
                        {
                            height: height,
                            width: width
                        })
                ],
                listeners: {
                    close: function() {
                        this.getEl().unmask();
                    },
                    scope: this
                }
            });
        },

        _onBoardLoad: function() {
            this._publishContentUpdated();
            this.setLoading(false);

        },


        _onBeforeCreate: function(addNew, record, params) {
            Ext.apply(params, {
                rankTo: 'BOTTOM',
                rankScope: 'BACKLOG'
            });
            record.set(this.getSetting('groupByField'), this.gridboard.getGridOrBoard().getColumns()[0].getValue());
        },

        _onBeforeEditorShow: function(addNew, params) {
            params.rankTo = 'BOTTOM';
            params.rankScope = 'BACKLOG';


            var groupByFieldName = this.groupByField.name;

            params[groupByFieldName] = this.gridboard.getGridOrBoard().getColumns()[0].getValue();
        },

        _onBeforeCardSaved: function(column, card, type) {
            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                var setting = columnSetting[column.getValue()];
                if (setting && setting.scheduleStateMapping) {
                    card.getRecord().set('ScheduleState', setting.scheduleStateMapping);
                }
            }
        },

        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
            this.recordComponentReady({
                miscData: {
                    swimLanes: this.getSetting('showRows'),
                    swimLaneField: this.getSetting('rowsField')
                }
            });
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});

        }
    });
})();
