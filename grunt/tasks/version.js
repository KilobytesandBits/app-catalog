module.exports = function(grunt) {

    var getSdkVersion = function() {
        if(process.env.APPSDK_SRC_VERSION){
            return process.env.APPSDK_SRC_VERSION;
        }

        var js_dependencies = grunt.file.readJSON('js_dependencies.json'),
            i, sdkVersion;

        for (i = 0; i < js_dependencies.length; i++) {
            var dep = js_dependencies[i];
            if (dep.id.match(/appsdk-src/)) {
                sdkVersion = dep.id.replace(/^.+:/, '');
                break;
            }
        }

        return sdkVersion;
    };

    var getBuildVersion = function(revision) {
        var artifactPrefix = process.env.ARTIFACT_PREFIX ? process.env.ARTIFACT_PREFIX + '-' : '';
        var counter = process.env.PIPELINE_COUNTER || process.env.BUILD_NUMBER || 'dev';
        return "" + artifactPrefix + counter + "-" + (revision.substr(0, 7)) + '-sdk-' + getSdkVersion();
    };

    var version = function() {
        var done = this.async(), setVersion = function (revision) {
            grunt.config(['buildVersion'], getBuildVersion(revision));
            done();
        };
        if (process.env.GIT_COMMIT) {
            setVersion(process.env.GIT_COMMIT);
        } else {
            grunt.util.spawn({
                cmd: 'git',
                args: "log -n 1 --pretty=format:%h".split(' ')
            }, function(err, stdout, stderr) {
                if (err) {
                    grunt.fail.warn(err);
                }
                setVersion(stdout.toString());
            });
        }
    };

    grunt.registerTask('version', 'Compute the build version for rally builds', version);

    grunt.registerTask('writeVersion', 'Write the build version to appsdk.version', function() {
        version.call(this);
        grunt.file.write('appcatalog.version', grunt.config('buildVersion'));
    });

};
