var stream = require('stream');

var gulp = require('gulp');
var gutil = require('gulp-util');
var _ = require('lodash-node');
var when = require('when/node');

var buffer = require('gulp-buffer');
var clean = require('gulp-clean');
var compile = require('gulp-dust');
var concat = require('gulp-concat');
var insert = require('gulp-insert');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var render = require('gulp-dust-render');
var phonyVinyl = require('vinyl-source-stream');
var uglify_ = require('gulp-uglify');

var pretty = {
    mangle : false,
    output : { beautify : true },
    compress : false,
    preserveComments : 'all'
};
var optimal = {};
/*
 * `pretty` introduces errors by separating some return values from their
 * `return` (with gulp-compile preserving whitespace.  Keeping it around for
 * js-doc use later.
 */
var uglify = function () { return uglify_(pretty); };

var primitives = ['Void', 'Bool', 'Float32', 'Float64',
                  'UInt8', 'UInt16', 'UInt32', 'UInt64',
                   'Int8',  'Int16',  'Int32',  'Int64'];

gulp.task('build', ['file', 'lists', 'anyPointer', 'base']);

gulp.task('ci', ['jshint', 'test', 'build']);

gulp.task('clean', function () {
    return gulp.src(['./build/**/*', './precompile/**/*'], {read : false})
        .pipe(clean());
});

gulp.task('test', function () {
    gulp.src('./test/**/*.js')
        .pipe(mocha({ reporter: 'list' }));
});

gulp.task('watch', function () {
    gulp.watch('./**/*.js', ['base']);
    gulp.watch([
        './decode/**/*.dust',
        './decode/helpers.js'
    ], ['precompiled']);
});

gulp.task('jshint', function () {
    return gulp.src('./**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('base', function () {
    return gulp.src('./base/*.js')
        .pipe(gulp.dest('build/base'));
});

gulp.task('decoders', function () {
    return gulp.src('./decoder/*.js')
        .pipe(gulp.dest('build/decoder'));
});

gulp.task('doc', function () {
    /* Parallel to build for full docs. */
    return gulp.src('./**/*.dust')
        .pipe(rename({ extname : "" }))
        .pipe(compile({ preserveWhitespace : true }))
        .pipe(jsdoc())
        .pipe(gulp.dest('doc'));
});

gulp.task('precompiled', function () {
    return gulp.src('./**/*.dust')
        .pipe(rename({ extname : "" }))
        .pipe(compile({ preserveWhitespace : false }))
        .pipe(concat('precompiled.js'))
        .pipe(insert.prepend('var dust = require("dustjs-linkedin");'))
        .pipe(gulp.dest('build'));
});

gulp.task('file', function () {
    return gulp.src(['./file.js', './helpers.js'])
        .pipe(gulp.dest('build'));
});

gulp.task('anyPointer', function () {
    return gulp.src(['./AnyPointer.js'])
        .pipe(gulp.dest('build'));
});

function sstream(text) {
    var s = new stream.Readable();
    s._read = function noop() {};
    s.push(text);
    s.push(null);

    return s;
}

function renderStream(promise) {
    var s = new stream.Readable();
    s._read = function noop() {};
    promise.done(
        function (rendering) {
            s.push(rendering);
            s.push(null);
        },
        console.error
    );

    return s;
}

var listTasks = _.map(primitives, function (primitive) { return 'list' + primitive; });
_(primitives).forEach(function (primitive) {
    gulp.task('list' + primitive, ['precompiled', 'decoders'], function () {
        var rendering = require('./rendering');
        return sstream(primitive)
            .pipe(phonyVinyl(primitive))
            .pipe(insert.wrap('"', '"'))
            .pipe(insert.wrap('{"type":', '}'))
            .pipe(buffer())
            .pipe(render(rendering.list.primitive))
              .on('error', gutil.log)
            .pipe(uglify())
            .pipe(rename({ extname: ".js" }))
            .pipe(gulp.dest('build/list'));
    });
});

gulp.task('listNested', ['precompiled'], function () {
    var rendering = require('./rendering');
    return renderStream(rendering.list.Nested())
        .pipe(phonyVinyl('nested.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('build/list'));
});
listTasks.push('listNested');

gulp.task('listStruct', ['precompiled'], function () {
    var rendering = require('./rendering');
    return renderStream(rendering.list.Struct())
        .pipe(phonyVinyl('struct.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('build/list'));
});
listTasks.push('listStruct');

gulp.task('listData', ['precompiled'], function () {
    var rendering = require('./rendering');
    return renderStream(rendering.list.Data())
        .pipe(phonyVinyl('Data.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('build/list'));
});
listTasks.push('listData');

gulp.task('listText', ['precompiled'], function () {
    var rendering = require('./rendering');
    return renderStream(rendering.list.Text())
        .pipe(phonyVinyl('Text.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('build/list'));
});
listTasks.push('listText');

gulp.task('listAnyPointer', ['precompiled'], function () {
    var rendering = require('./rendering');
    return renderStream(rendering.list.AnyPointer())
        .pipe(phonyVinyl('AnyPointer.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('build/list'));
});
listTasks.push('listAnyPointer');

gulp.task('lists', listTasks);
