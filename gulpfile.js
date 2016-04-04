/*
|--------------------------------------------------------------------------
| Dependencies
|--------------------------------------------------------------------------
|
| Below you can add all files and plugins you need within
| your tasks.
|
*/
var gulp = require('gulp');
var gutil = require('gulp-util');
var gulpSequence = require('gulp-sequence');
var gulpif = require('gulp-if');
var connect = require('gulp-connect');
var tslint = require('gulp-tslint');
var tslintStylish = require('gulp-tslint-stylish');
var less = require('gulp-less');
var cleanCSS = require('gulp-clean-css');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var filter = require('gulp-filter');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var inlineNg2Template = require('gulp-inline-ng2-template');
var preprocess = require('gulp-preprocess');
var rename = require('gulp-rename');
var clean = require('gulp-clean');
var ts = require('gulp-typescript');
var iconfont = require('gulp-iconfont');
var iconfontCss = require('gulp-iconfont-css');
var argv = require('yargs').argv;
var notifier = require('node-notifier');
var assign = require('lodash.assign');
var path = require('path');

var ng2RelativePath = requireIfExists(
  '../gulp-ng2-relative-path',
  'gulp-ng2-relative-path'
);

/*
|--------------------------------------------------------------------------
| Global Definitions
|--------------------------------------------------------------------------
|
| All configurations can be defined in config.js. The environment
| will be set automatically and can be changed by using either
| "gulp build" or "gulp dev-build".
|
| Also all other global definitions go here, like defining the
| typescript project.
|
*/
var config = require('./config');
config.env = process.env.NODE_ENV;

// Determine environment before it is set for initialization
process.env.NODE_ENV = config.env = argv._[0] === 'build' ? 'production' : 'development';

// Setup TypeScript project
var tsConfig = require('./tsconfig.json');
var tsProject = ts.createProject(assign(tsConfig, {
  sortOutput: true,
  outFile: config.mode === 'lazy' ? false : config.ts.name
}));


/*
|--------------------------------------------------------------------------
| Internal Tasks
|--------------------------------------------------------------------------
|
| Tasks are defined below, that are used internally:
|
| - clean:*
|     Deletes the specific files, based on the clean task.
|
| - uglify
|     Minifies the JavaScript sorce files and adds inline
|     sourcemaps if the environment is not production.
|
| - less
|     Compiles less files and saves it into the distribution
|     folder.
|
| - copy:*
|     Copies files according to the task name.
|
| - bundle:*
|     Bundles files according to the task name.
|
| - lint:*
|     Lints specific types of files.
|
*/
gulp.task('clean:all', function() {
  return gulp.src([config.dist], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:scripts', function() {
  return gulp.src([
      config.dist + '/js/**/*.js',
      config.dist + '/js/**/*.map'
    ], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:vendor', function() {
  return gulp.src([config.vendor.dest], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:styles', function() {
  return gulp.src([
      config.dist + '/css/**/*.css',
      config.dist + '/css/**/*.map'
    ], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:iconfont', function() {
  return gulp.src(config.icons.dest + '/**/*', {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:index', function() {
  return gulp.src([config.dist + '/index.html'], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:html', function() {
  return gulp.src([config.dist + '/**/*.html'], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('clean:assets', function() {
  return gulp.src([config.dist + '/assets/**/*'], {
      read: false
    })
    .pipe(clean().on('error', onError))
    .on('error', onError);
});

gulp.task('typescript:main', function() {
  var less = require('less'),
    jade = require('jade');
  less.renderSync = function(input, options) {
    if (!options || typeof options != "object") options = {};
    options.sync = true;
    var css;
    this.render(input, options, function(err, result) {
      if (err) throw err;
      css = result.css;
    });
    return css;
  };

  var pattern = new RegExp('^(' + config.ts.appBase + '/?)');

  var tsResult = gulp.src([config.ts.src], {
      'cwd': './'
    })
    .pipe(gulpif(config.env !== 'production', sourcemaps.init({
      loadMaps: false
    }).on('error', onError)))
    .pipe(preprocess({
      context: {
        config: config
      }
    }).on('error', onError))
    .pipe(gulpif(config.mode === 'lazy', ng2RelativePath({
      base: config.ts.base,
      appBase: config.ts.appBase,
      modifyPath: function(path) {
        return path.replace('.less', '.css');
      }
    }).on('error', onError)).on('error', onError))
    .pipe(gulpif(config.mode === 'bundle', inlineNg2Template({
      // base: config.src + '/js',
      target: 'es5',
      removeLineBreaks: true,
      useRelativePaths: true,
      templateProcessor: function(path, file) {
        return file;
        //return jade.render(file);
      },
      styleProcessor: function(path, file) {
        return less.renderSync(file);
      },
      templateFunction: function(filename) {
        return filename.replace(pattern, './');
      }
    }).on('error', onError)).on('error', onError))
    .pipe(ts(tsProject).on('error', onError));

  var base = path.join(__dirname, config.ts.base);
  while (base.charAt(0) === '/') base = base.substr(1);

  return tsResult.js
    .pipe(rename(function(p) {
      p.dirname = p.dirname.replace(base, './');
    }).on('error', onError))
    .pipe( /*gulpif(config.env === 'production', */ uglify().on('error', onError) /*)*/ )
    .pipe(gulpif(config.env !== 'production', sourcemaps.write('./').on('error', onError)))
    .pipe(gulp.dest(config.ts.dest))
});

gulp.task('typescript:lazy', function(done) {
  if (config.mode === 'bundle') {
    return done();
  }

  return gulpSequence(['typescript:lazy:css', 'typescript:lazy:html'])(done);
});

gulp.task('typescript:lazy:css', function() {
  return gulp.src([config.ts.base + '/**/*.css', config.ts.base + '/**/*.less'])
    .pipe(gulpif(config.env !== 'production', sourcemaps.init().on('error', onError)))
    .pipe(less().on('error', onError))
    .pipe(cleanCSS().on('error', onError))
    .pipe(gulpif(config.env !== 'production', sourcemaps.write('./').on('error', onError)))
    .pipe(gulp.dest(config.ts.dest))
    .on('error', onError);
});

gulp.task('typescript:lazy:html', function() {
  return gulp.src([config.ts.base + '/**/*.html'])
    .pipe(gulp.dest(config.ts.dest))
    .on('error', onError);
});

gulp.task('less', function() {
  return gulp.src(config.less.src)
    .pipe(gulpif(config.env !== 'production', sourcemaps.init().on('error', onError)))
    .pipe(less().on('error', onError))
    .pipe(cleanCSS().on('error', onError))
    .pipe(rename(config.less.name).on('error', onError))
    .pipe(gulpif(config.env !== 'production', sourcemaps.write('./').on('error', onError)))
    .pipe(gulp.dest(config.less.dest))
    .on('error', onError);
});

gulp.task('copy:index', function() {
  return gulp.src(config.index.src)
    .pipe(preprocess({
      context: {
        config: config
      }
    }).on('error', onError))
    .pipe(rename(config.index.name).on('error', onError))
    .pipe(gulp.dest(config.index.dest))
    .on('error', onError);
});

gulp.task('copy:assets', function() {
  return gulp.src(config.assets.src)
    .pipe(gulp.dest(config.assets.dest))
    .on('error', onError);
});

gulp.task('copy:originals', function(done) {
  var src = clone(config.copy);
  var sources = [],
    destinations = [];

  src.forEach(function(element, index) {
    sources = [];

    element.src.forEach(function(path) {
      sources.push(element.base + path);
    });

    gulp.src(sources, {
        base: config.src + element.base
      })
      .pipe(gulp.dest(element.dest))
      .on('error', onError);
  });

  done();
});

gulp.task('bundle:vendor', function(done) {
  var src = clone(config.vendor.files);
  var sources = [],
    g = gulp;

  src.forEach(function(element, index) {
    element.src.forEach(function(path) {
      sources.push(element.base + path);
    });
  });

  return gulp.src(sources)
    .pipe(gulpif(config.env !== 'production', sourcemaps.init({
      loadMaps: false
    }).on('error', onError)))
    .pipe(concat('bundle.js'))
    .pipe(uglify({
      mangle: true
    }))
    .pipe(gulpif(config.env !== 'production', sourcemaps.write('./').on('error', onError)))
    .pipe(gulp.dest(config.vendor.dest));
});

gulp.task('lint:ts', function() {
  return gulp.src([config.ts.src])
    .pipe(tslint())
    .pipe(tslint.report(tslintStylish))
    .on('error', notifyError);
});

gulp.task('iconfont', function() {
  f = filter(['**/*.css'], {
    restore: true
  });

  gulp.src(config.icons.src)
    .pipe(iconfontCss({
      fontName: config.icons.fontName,
      cssClass: config.icons.cssClass,
      path: config.icons.templatePath,
      targetPath: config.icons.cssDest,
      fontPath: config.icons.fontDest
    }).on('error', onError))
    .pipe(f)
    .pipe(cleanCSS().on('error', onError))
    .pipe(f.restore)
    .pipe(iconfont({
      fontName: config.icons.fontName
    }).on('error', onError))
    .pipe(gulp.dest(config.icons.dest));
});

/*
|--------------------------------------------------------------------------
| Helper Tasks
|--------------------------------------------------------------------------
|
| The following tasks are used as helpers. Currently
| tasks exist to change the envoronment and to reload
| the browser when something has chaged (live reload).
|
*/
gulp.task('set-dev', function() {
  return process.env.NODE_ENV = config.env = 'development';
});
gulp.task('set-prod', function() {
  return process.env.NODE_ENV = config.env = 'production';
});

gulp.task('reload', function() {
  return gulp.src('./dist/*.html')
    .pipe(connect.reload());
});

gulp.task('start', function(done) {
  gutil.log(gutil.colors.green('Starting ' + config.env + ' build...'));

  return done();
});

gulp.task('finish', function(done) {
  gutil.log(gutil.colors.green('Build has finished.'));

  notifier.notify({
    title: 'Build Successful',
    message: 'All build tasks have finished and your app is ready.'
  });

  return done();
});

/*
|--------------------------------------------------------------------------
| Helper Functions
|--------------------------------------------------------------------------
|
| Simple functions for different purposes.
|
*/

function onError(error) {
  gutil.log(gutil.colors.red('Error: ' + error));
  notifyError(error);
}

function notifyError(error) {
  notifier.notify({
    title: 'Error',
    message: 'There was an error building your app.'
  });
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function exists(nodeModule) {
  try {
    require.resolve(nodeModule)
  } catch (e) {
    return false;
  }

  return true;
}

function requireIfExists(nodeModule, fallbackModule) {
  if (exists(nodeModule)) {
    return require(nodeModule)
  }

  if (fallbackModule) {
    return require(fallbackModule);
  }
}

/*
|--------------------------------------------------------------------------
| Task Collections
|--------------------------------------------------------------------------
|
| The tasks below bundle common sequences:
|
| - tasks
|     The main task sequence.
|
| - copy
|     Should bundle all tasks prefixed with "copy:".
|
| - clean:default
|     Only clear scripts (excluding vendor), styles and the index.
|
| - bundle
|     Execute all available bundle tasks.
|
| - lint
|     Run all available lint tasks.
|
| - typescript
|     Runs all required typescript tasks.
|
*/
gulp.task('tasks', function(done) {
  return gulpSequence(['copy', 'typescript', 'less'])(done);
});

gulp.task('copy', function(done) {
  return gulpSequence(['copy:index', 'copy:assets', 'copy:originals'])(done);
});

gulp.task('clean:default', function(done) {
  return gulpSequence(['clean:scripts', 'clean:styles', 'clean:index'])(done);
});

gulp.task('bundle', function(done) {
  return gulpSequence(['bundle:vendor'])(done);
});

gulp.task('lint', function(done) {
  return gulpSequence(['lint:ts'])(done);
});

gulp.task('typescript', function(done) {
  return gulpSequence(['typescript:main', 'typescript:lazy'])(done);
});


/*
|--------------------------------------------------------------------------
| Main Tasks
|--------------------------------------------------------------------------
|
| These tasks are intended to be called via the console:
|
| - build
|     Performs a production build.
|
| - dev-build
|     Performs a development build.
|
| - watch-build
|     Tasks that should run if a file changes.
|
| - watch
|     Performs a development build everytime
|     something has changes.
|
| - serve
|     Brings up a server, to test the app
|     locally.
|
*/
gulp.task('build', function(done) {
  return gulpSequence('set-prod', 'start', 'lint', 'clean:all', ['tasks', 'bundle', 'iconfont'], 'finish')(done);
});

gulp.task('dev-build', function(done) {
  return gulpSequence('set-dev', 'start', 'lint', 'clean:default', ['tasks', 'iconfont'], 'finish')(done);
});

gulp.task('watch-build', function(done) {
  return gulpSequence('set-dev', 'start', 'lint', 'clean:default', ['tasks',  'iconfont'], 'finish')(done);
});

gulp.task('watch', function() {
  gulpSequence('dev-build')(function() {
    gulp.watch(config.watch, ['watch-build']);
  });
});

gulp.task('serve', function() {
  connect.server({
    root: config.dist,
    livereload: true,
    https: false,
    port: 5000
  });
});
