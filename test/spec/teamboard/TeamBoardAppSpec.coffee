Ext = window.Ext4 || window.Ext

Ext.require [
  'Rally.apps.teamboard.TeamBoardProjectRecordsLoader'
]

describe 'Rally.apps.teamboard.TeamBoardApp', ->
  helpers
    assertFieldsShownOnCard: (fieldNames) ->
      cardEl = @cardboard().getColumns()[0].getCards()[0].getEl()

      expect(cardEl.query('.field-content').length).toBe fieldNames.length

      for fieldName in fieldNames
        expect(cardEl.down('.field-content.' + fieldName)).not.toBeNull()

    cardboard: ->
      @app.down('.rallycardboard')

    createApp: (options = {}) ->
      @stubIsAdmin if options.isAdmin? then options.isAdmin else true
      @stubProjectRecords options.projectRecords || @projectRecords

      @app = Ext.create 'Rally.apps.teamboard.TeamBoardApp', Ext.apply(
        context: Ext.create 'Rally.app.Context'
      , options.appConfig)

      if options.appConfig?.renderTo then @waitForComponentReady(@app) else webdriver.promise.fulfilled(@app)

    stubIsAdmin: (isAdmin) ->
      @stub(Rally.environment.getContext().getPermissions(), 'isWorkspaceOrSubscriptionAdmin').returns isAdmin

    stubProjectRecords: (projectRecords) ->
      @stub Rally.apps.teamboard.TeamBoardProjectRecordsLoader, 'load', (teamOids, callback, scope) ->
        callback.call scope, projectRecords

  beforeEach ->
    @ajax.whenQuerying('user').respondWith @mom.getData('user')

    @projectRecords = @mom.getRecords 'project',
      count: 4

  afterEach ->
    @app?.destroy()

  it 'should show a message when user does not have access to any of the teams chosen', ->
    @createApp(
      projectRecords: []
      appConfig:
        renderTo: 'testDiv'
    ).then =>
      expect(@app.getEl().down('.no-data')).not.toBe null

  it 'should show a board with one column per team', ->
    @createApp().then =>
      expect(@cardboard().columns.length).toBe @projectRecords.length

  it 'should show non-disabled team members in each column', ->
    @createApp(
      appConfig:
        renderTo: 'testDiv'
    ).then =>
      expect(@cardboard().getColumns()[0].store).toOnlyHaveFilters [
        ['TeamMemberships', 'contains', @projectRecords[0].get('_ref')]
        ['Disabled', '=', 'false']
      ]

  it 'should create a readOnly board when current user is not an admin', ->
    @createApp(
      isAdmin: false
    ).then =>
      expect(@cardboard().readOnly).toBe true

  it 'should create a drag-n-drop-able board when current user is an admin', ->
    @createApp(
      isAdmin: true
    ).then =>
      expect(@cardboard().readOnly).toBe false

  it 'should show the team name in the column header', ->
    @createApp(
      appConfig:
        renderTo: 'testDiv'
    ).then =>
      headerHtml = @cardboard().getColumns()[0].getHeaderTitle().getEl().down('.columnTpl').getHTML()
      Assert.contains headerHtml, @projectRecords[0].get('_refObjectName')

  describe 'card fields', ->
    helpers
      createAppWithCardFields: (cardFields, isAdmin = true) ->
        @createApp
          appConfig:
            renderTo: 'testDiv'
            settings:
              cardFields: cardFields
          isAdmin: isAdmin

    it 'should be OfficeLocation and Phone by default', ->
      @createAppWithCardFields().then =>
        @assertFieldsShownOnCard ['OfficeLocation', 'Phone']

    it 'should allow no fields to be shown', ->
      @createAppWithCardFields(null).then =>
        @assertFieldsShownOnCard []

    it 'should be the chosen card fields', ->
      @createAppWithCardFields('EmailAddress,OnpremLdapUsername').then =>
        @assertFieldsShownOnCard ['EmailAddress', 'OnpremLdapUsername']

    it 'should not show card fields not visible to non-admins when user is a non-admin', ->
      @createAppWithCardFields('EmailAddress,OnpremLdapUsername', false).then =>
        @assertFieldsShownOnCard ['EmailAddress']