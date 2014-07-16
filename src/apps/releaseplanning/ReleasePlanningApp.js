(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.releaseplanning.ReleasePlanningApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.data.util.PortfolioItemHelper',
            'Rally.ui.gridboard.planning.TimeboxGridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker'
        ],

        launch: function() {
            Rally.data.util.PortfolioItemHelper.loadTypeOrDefault({
                defaultToLowest: true,
                success: function (piTypeDef) {
                    this._buildGridBoard(piTypeDef.get('TypePath'));
                },
                scope: this
            });
        },

        getSettingsFields: function () {
            return [ {type: 'project'} ];
        },

        _buildGridBoard: function (piTypePath) {
            this.gridboard = this.add({
                xtype: 'rallytimeboxgridboard',
                cardBoardConfig: {
                    columnConfig: {
                        columnStatusConfig: {
                            pointField: 'LeafStoryPlanEstimateTotal'
                        }
                    },
                    listeners: {
                        filter: this._onBoardFilter,
                        filtercomplete: this._onBoardFilterComplete,
                        scope: this
                    }
                },
                context: this.getContext(),
                endDateField: 'ReleaseDate',
                listeners: {
                    load: this._onLoad,
                    toggle: this._publishContentUpdated,
                    recordupdate: this._publishContentUpdatedNoDashboardLayout,
                    recordcreate: this._publishContentUpdatedNoDashboardLayout,
                    preferencesaved: this._publishPreferenceSaved,
                    scope: this
                },
                modelNames: [piTypePath],
                plugins: [
                    {
                        ptype: 'rallygridboardaddnew',
                        rankScope: 'BACKLOG'
                    },
                    {
                        ptype: 'rallygridboardfieldpicker',
                        boardFieldBlackList: [
                            'ObjectID',
                            'Description',
                            'DisplayColor',
                            'FormattedID',
                            'Name',
                            'Notes',
                            'Ready',
                            'AcceptedLeafStoryCount',
                            'AcceptedLeafStoryPlanEstimateTotal',
                            'DirectChildrenCount',
                            'LeafStoryCount',
                            'LeafStoryPlanEstimateTotal',
                            'Rank',
                            'DragAndDropRank',
                            'UnEstimatedLeafStoryCount',
                            'CreationDate',
                            'Subscription',
                            'Workspace',
                            'Changesets',
                            'Discussion',
                            'LastUpdateDate',
                            'Owner'
                        ],
                        headerPosition: 'left'
                    }
                ],
                startDateField: 'ReleaseStartDate',
                timeboxType: 'Release'
            });
        },

        _onLoad: function() {
            this._publishContentUpdated();
            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _onBoardFilter: function() {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function() {
            this.setLoading(false);
        },

        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        },

        _publishPreferenceSaved: function(record) {
            this.fireEvent('preferencesaved', record);
        }
    });
})();
