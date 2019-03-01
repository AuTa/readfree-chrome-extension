var gulp = require('gulp');
var uglify = require('gulp-uglify-es').default;
var pump = require('pump');
var concat = require('gulp-concat');

gulp.task('default', ['compress'], function() {
    // gulp.watch('src/show.js', ['default']);
    gulp.src(['src/zepto.min.js', 'tmp/show.js'])
        .pipe(concat('show.js'))
        .pipe(gulp.dest('build'));
    return gulp.src('tmp/background.js').pipe(gulp.dest('build'));
});

gulp.task('debug', function () {
    gulp.watch('src/show.js', ['debug']);
    return gulp.src(['src/zepto.min.js', 'src/show.js'])
        .pipe(concat('show.js'))
        .pipe(gulp.dest('build'));
});

gulp.task('compress', function () {
    return gulp.src(['src/show.js', 'src/background.js'])
        .pipe(uglify().on('error', function(e){console.log(e)}))
        .pipe(gulp.dest('tmp'));
});
