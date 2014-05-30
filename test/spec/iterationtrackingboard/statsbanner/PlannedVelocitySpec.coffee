Ext = window.Ext4 || window.Ext

Ext.require [
  'Rally.util.Colors'
]

describe 'Rally.apps.iterationtrackingboard.statsbanner.PlannedVelocity', ->

  helpers
    createPane: (config={}) ->
      @store = Ext.create 'Ext.data.Store',
        model: Rally.test.mock.data.WsapiModelFactory.getModel 'userstory'
      @pane = Ext.create 'Rally.apps.iterationtrackingboard.statsbanner.PlannedVelocity', _.defaults config,
        renderTo: 'testDiv'
        store: @store
        context:
          getWorkspace: -> Rally.environment.getContext().getWorkspace()
          getTimeboxScope: =>
            config.scope || Ext.create 'Rally.app.TimeboxScope', record: @mom.getRecord 'iteration'

    refreshPane: (config={}, records) ->
      @createPane config
      @spy @pane, 'refreshChart'
      @store.add records || @mom.getRecord 'userstory'
      @waitForCallback @pane.refreshChart

    createAndWaitForUpdate: (config={}, records) ->
      @createPane config
      updateSpy = @spy @pane, 'update'
      @store.add records || @mom.getRecord 'userstory'
      @waitForCallback(updateSpy)

  afterEach ->
    Rally.test.destroyComponentsOfQuery 'statsbannerplannedvelocity'

  describe 'should calculate renderData correctly', ->
    it 'for iteration unit', ->
      @createAndWaitForUpdate().then (updateSpy) ->
        unit = updateSpy.getCall(0).args[0].unit
        expect(unit).toBe Rally.environment.getContext().getWorkspace().WorkspaceConfiguration.IterationEstimateUnitName

    it 'for release unit', ->
      @createAndWaitForUpdate(
        scope: Ext.create 'Rally.app.TimeboxScope', record: @mom.getRecord 'release'
      ).then (updateSpy) =>
        unit = updateSpy.getCall(0).args[0].unit
        expect(unit).toBe Rally.environment.getContext().getWorkspace().WorkspaceConfiguration.ReleaseEstimateUnitName

    describe 'should calculate percentage correctly', ->
      it 'for zero estimate and zero plannedVelocity', ->
        record = @mom.getRecord 'userstory',
          values:
            PlanEstimate: 0
        scope = Ext.create 'Rally.app.TimeboxScope',
          record: @mom.getRecord 'iteration',
            values:
              PlannedVelocity: 0
        @createAndWaitForUpdate(scope: scope, record).then (updateSpy) =>
          expect(updateSpy.getCall(0).args[0].percentage).toBe 0
          expect(@pane.getEl().down('.metric-chart-text').dom.innerHTML).toContain '0'
          expect(@pane.getEl().down('.metric-subtext').dom.innerHTML).toContain '0 of 0 Points'

      it 'for some estimate and zero plannedVelocity', ->
        record = @mom.getRecord 'userstory',
          values:
            PlanEstimate: 5
        scope = Ext.create 'Rally.app.TimeboxScope',
          record: @mom.getRecord 'iteration',
            values:
              PlannedVelocity: 0
        @createAndWaitForUpdate(scope: scope, record).then (updateSpy) =>
          expect(updateSpy.getCall(0).args[0].percentage).toBe 0
          expect(@pane.getEl().down('.metric-chart-text').dom.innerHTML).toContain '0'
          expect(@pane.getEl().down('.metric-subtext').dom.innerHTML).toContain '5 of 0 Points'

      it 'for typical estimate and plannedVelocity', ->
        record = @mom.getRecord 'userstory',
          values:
            PlanEstimate: 5
        scope = Ext.create 'Rally.app.TimeboxScope',
          record: @mom.getRecord 'iteration',
            values:
              PlannedVelocity: 5
        @createAndWaitForUpdate(scope: scope, record).then (updateSpy) =>
          expect(updateSpy.getCall(0).args[0].percentage).toBe 100
          expect(@pane.getEl().down('.metric-chart-text').dom.innerHTML).toContain '100'
          expect(@pane.getEl().down('.metric-subtext').dom.innerHTML).toContain '5 of 5 Points'

      it 'for decimals in accepted and total', ->
        record = @mom.getRecords 'userstory',
          values: [
            {PlanEstimate: .1, ScheduleState: 'Accepted'}
            {PlanEstimate: .1, ScheduleState: 'Accepted'}
            {PlanEstimate: .1, ScheduleState: 'Accepted'}
          ]
          count: 3
        scope = Ext.create 'Rally.app.TimeboxScope',
          record: @mom.getRecord 'iteration',
            values:
              PlannedVelocity: 5
        @createAndWaitForUpdate(scope: scope, record).then (updateSpy) =>
          expect(updateSpy.getCall(0).args[0].percentage).toBe 6
          expect(@pane.getEl().down('.metric-chart-text').dom.innerHTML).toContain '6'
          expect(@pane.getEl().down('.metric-subtext').dom.innerHTML).toContain '0.3 of 5 Points'

  describe 'should calculate chartConfig correctly', ->
    it 'for over 100%', ->
      record = @mom.getRecord 'userstory',
        values:
          PlanEstimate: 5
      scope = Ext.create 'Rally.app.TimeboxScope',
        record: @mom.getRecord 'iteration',
          values:
            PlannedVelocity: 4
      @refreshPane(scope: scope, record).then =>
        firstSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[0]
        secondSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[1]
        expect(firstSeries.y).toBe 25
        expect(firstSeries.color).toBe Rally.util.Colors.blue
        expect(secondSeries.color).toBe Rally.util.Colors.cyan

    it 'for 71-100%', ->
      record = @mom.getRecord 'userstory',
        values:
          PlanEstimate: 3
      scope = Ext.create 'Rally.app.TimeboxScope',
        record: @mom.getRecord 'iteration',
          values:
            PlannedVelocity: 4
      @refreshPane(scope: scope, record).then =>
        firstSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[0]
        secondSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[1]
        expect(firstSeries.y).toBe 75
        expect(firstSeries.color).toBe Rally.util.Colors.cyan
        expect(secondSeries.color).toBe Rally.util.Colors.grey1

    it 'for 1-70%', ->
      record = @mom.getRecord 'userstory',
        values:
          PlanEstimate: 2
      scope = Ext.create 'Rally.app.TimeboxScope',
        record: @mom.getRecord 'iteration',
          values:
            PlannedVelocity: 4
      @refreshPane(scope: scope, record).then =>
        firstSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[0]
        secondSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[1]
        expect(firstSeries.y).toBe 50
        expect(firstSeries.color).toBe Rally.util.Colors.cyan_med
        expect(secondSeries.color).toBe Rally.util.Colors.grey1

    it 'for 0%', ->
      record = @mom.getRecord 'userstory',
        values:
          PlanEstimate: 0
      scope = Ext.create 'Rally.app.TimeboxScope',
        record: @mom.getRecord 'iteration',
          values:
            PlannedVelocity: 4
      @refreshPane(scope: scope, record).then =>
        firstSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[0]
        secondSeries = @pane.refreshChart.getCall(0).args[0].chartData.series[0].data[1]
        expect(firstSeries.y).toBe 100
        expect(firstSeries.color).toBe Rally.util.Colors.grey1
        expect(secondSeries.color).toBe Rally.util.Colors.grey1

    it 'should reset accepted count on datachange', ->
      @createPane percentage: 5

      @spy @pane, 'refreshChart'
      @store.add @mom.getRecord 'userstory'
      @waitForCallback(@pane.refreshChart).then =>
        expect(@pane.getEl().down('.stat-metric').dom.innerHTML).toContain '0'
