(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.mrshim.MrShimApp", {
        name: 'rally-mrshim-app',
        extend: "Rally.app.App",
        componentCls: 'mrshim-app',
        config: {
            defaultSettings: {
                url: '/easel/my/myfile.js'
            }
        },
        chart:null,

        requires: [
        ],
        items: [
            {
                xtype: 'container',
                itemId: 'mrcontainer',
                cls: 'mrcontainer'
            }
        ],

        help: {
            id: 279
        },

        settingsTransformers: {
            'combobox': function(original) {
                return {
                    xtype: 'rallycombobox',
                    valueField: 'value',
                    displayField: 'label',
                    name: original.name,
                    store: {
                        xtype: "store",
                        fields: [
                            'label','value'
                        ],
                        data: original.values || [{label:'data expected is \'label\' and \'value\'',value:''}]
                    }
                };
            }
        },

        getSettingsFields: function () {
            var fields = this.callParent(arguments);

            fields.push({
                type: "text",
                name: "url",
                label: "URL To Load"
            });

            var self = this;

            _.each(this.appPrefs, function(pref) {
                var p = pref;
                if (self.settingsTransformers[pref.type]) {
                    p = self.settingsTransformers[pref.type](pref);
                }
                fields.push(p);
            });

            return fields;
        },

        getDefaultSettings: function() {
            var defaults = this.callParent(arguments);
            _.each(this.appPrefs, function(pref) {
                defaults[pref.name] = pref['default'];
            });
            return defaults;
        },

        launch: function () {
            window.x = this;
            var self = this;
            this.callParent(arguments);


            // get the element we're going to use as the container (defined above in items)
            // this .down call is Ext specific
            var stupidExt = this.down("#mrcontainer");

            // create the API that will be passed in (the execution context if you will) to the
            // chart that's loaded


            // feature toggles are an ENVIRONMENT/shim specific thing and are NOT
            // exposed to the chart apps. ??? it seems like maybe chart apps could
            // still make use of toggles.?

            // provide port(s) for the chart app to use
            var shimApi = {
                el: function() {
                    // this evaluation needs to occur delayed
                    return stupidExt.el.dom;
                },
                lbapiUrl: function() {
                    var context = Rally.environment.getContext().getDataContext();
                    return Rally.environment.getServer().getLookbackUrl(this.version) + '/service/rally/workspace/' +
                        Rally.util.Ref.getOidFromRef(context.workspace) + '/artifact/snapshot/query';
                },
                getProject: function() { return self.getContext().getProject().ObjectID; },
                getRelease: function() { return 10758565528; },
                toggleEnabled : function(name) { return false;},
                getPreference: function(n) {
                    return self.getSetting(n) || self.defaultSettings[n];
                },
				log: function(a,b) {
					console.log(a,b);
				}
            }


            // example - binding events to the chart app
            Ext4.EventManager.onWindowResize(function() {
                if (self.chart.onResize) {
                    self.chart.onResize();
                }
            }, this);


            var toload = this.settings.url;

            window.require = window._require;
            Ext.Loader.injectScriptElement("/easel/lib/require-2.1.11-min.js", function() {
                requirejs.config({
					baseUrl: '/easel/lib/',
                    "paths": {
                        "highcharts": "/moosenshim/highcharts-3.0.10",
						'jquery': '//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min'
                    },
                    shim: {
                        "highcharts": {
                            "exports": "Highcharts",
                            "deps": [ "jquery"]
                        },
                        "lumenize-0.7.3-min": {
                            exports: "require"
                        }
                    }
                });
                if (!window._require) {
                    window._require = require;
                }
                require(['engine'],function(engineFactory) {
                    engineFactory(toload, function(loadedEngine){
                        self.engine = loadedEngine;
                        self.engine.init(shimApi);
                        self.appPrefs = self.engine.prefs();
                        _.each(self.appPrefs, function(pref) {
                            if (pref['default']) {
                                self.defaultSettings[pref.name] = pref['default'];
                            }
                        });
                        self.engine.launch();
                    });
                });

            },function(){},this);


        }
    });

}());
