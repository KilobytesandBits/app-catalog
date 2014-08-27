(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.portfolioitemstreegrid.PortfolioItemsTreeGridApp', {
        extend: 'Rally.apps.treegrid.TreeGridApp',
        requires: [
          'Rally.ui.grid.TreeGrid',
          'Rally.ui.grid.plugin.TreeGridExpandedRowPersistence',
          'Rally.ui.gridboard.GridBoard',
          'Rally.ui.gridboard.plugin.GridBoardPortfolioItemTypeCombobox',
          'Rally.data.util.PortfolioItemTypeDefArrayGenerator',
          'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl'
        ],
        alias: 'widget.portfolioitemstreegridapp',
        componentCls: 'pitreegrid',
        loadGridAfterStateRestore: false, //grid will be loaded once modeltypeschange event is fired from the type picker

        statePrefix: 'portfolioitems',

        config: {
            defaultSettings: {
                columnNames: ['Name', 'PercentDoneByStoryPlanEstimate', 'PercentDoneByStoryCount', 'PreliminaryEstimate', 'PlannedStartDate', 'PlannedEndDate', 'ValueScore', 'RiskScore', 'InvestmentCategory']
            }
        },

        constructor: function (config) {
            this.callParent(arguments);

            this._configureFilter();
        },

        _configureFilter: function() {
            this.filterControlConfig = {
                blacklistFields: ['PortfolioItemType', 'State'],
                stateful: true,
                stateId: this.getContext().getScopedStateId('portfolio-tree-custom-filter-button'),
                whiteListFields: ['Milestones']
            };
        },

        launch: function() {
            if(!this.rendered) {
                this.on('afterrender', this._getPortfolioItemTypeDefArray, this, {single: true});
            } else {
                this._getPortfolioItemTypeDefArray();
            }
        },

        _getTypeDefGenerator: function() {
            return Ext.create('Rally.data.util.PortfolioItemTypeDefArrayGenerator')
        },

        _getPortfolioItemTypeDefArray: function() {
            this._getTypeDefGenerator()
            .get(this.getContext().getDataContext())
            .then({
                success: this._loadAppWithPortfolioItemType,
                scope: this
            });
        },

        _loadAppWithPortfolioItemType: function(piTypeDefArray) {
            var allPiTypePaths = _.pluck(piTypeDefArray, 'TypePath');

            this.piTyeDefArray = piTypeDefArray;

            this._loadApp(allPiTypePaths);
        },

        _getGridBoardPlugins: function() {
            var plugins = this.callParent();
            plugins.push({
                ptype: 'rallygridboardpitypecombobox',
                context: this.getContext()
            });
            return plugins;
        }
    });
})();
