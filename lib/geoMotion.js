"use strict";

/* global ymaps */

// оригинал layout.image.canvas
// это расширенная версия с возможностью поворота
ymaps.modules.define("taxi.image_layout", [
    'util.defineClass',
    "util.hd",
    "Monitor",
    "shape.Rectangle",
    "geometry.pixel.Rectangle",
    "event.Manager",
    "util.imageLoader",
    "canvasLayout.storage"
], function (provide, defineClass, utilHD, Monitor, shapeRectangle, pixelRectangle, EventManager, imageLoader, layoutStorage) {
    function ImageLayout(data) {
        this._data = data;
        this._image = null;
        this.events = new EventManager({
            context: this
        });
        this._offscreenCanvas = document.createElement('canvas');
        this._offscreenContext = null;

        this._clipRect = [];
        this._originalSize = [];
    }

    defineClass(ImageLayout, {
        //TODO: суда приходит renderingContext, полная версия которого еще не готова(в бранче рефакторинга графики)
        // http://stackoverflow.com/questions/17411991/html5-canvas-rotate-image
        renderLayout: function (renderingContext) {
            if (this._image && this._image.width) {
                var size = this.getSize();
                // var offset = [0, 0];//this.getOffset(),
                var clipRect = this._clipRect;
                var shift = clipRect[0];
                var canvas = renderingContext.canvasContext;
                var originalSize = this._originalSize;

                // canvas.save() и canvas.restore() происходит в graphics.render.canvas.shape.Layout

                var rotation = this.getData().geoObject.options.getAll().iconImageRotation;
                if (rotation) {
                    canvas.translate(this._imageSize[0] / 2, this._imageSize[1] / 2);
                    canvas.rotate(rotation * Math.PI / 180);
                    canvas.translate(-this._imageSize[0] / 2, -this._imageSize[1] / 2);
                }

                // Pre-render similar primitives or repeating objects on an off-screen canvasPre-render similar primitives or repeating objects on an off-screen canvas
                // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvashttps://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
                if (!this._offscreenContext) {
                    this._offscreenContext = this._offscreenCanvas.getContext('2d');
                    this._offscreenContext.drawImage(this._image, 0, 0);
                }

                // image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
                canvas.drawImage(
                    this._offscreenCanvas,
                    shift[0], // Source shift.
                    shift[1],
                    this._imageSize[0] - shift[0], //Math.max(1, Math.min(this._imageSize[0] - shift[0], originalSize[0])), // Source size.
                    this._imageSize[1] - shift[1], //Math.max(1, Math.min(this._imageSize[1] - shift[1], originalSize[1])),
                    // Округляем конечные конечные значения чтобы не допустить размытия.
                    0, // offset[0], // Offset
                    0, // offset[1],
                    size[0], // Dest size
                    size[1]
                );
            }
        },

        destroy: function () {
            this.clear();
        },

        getData: function () {
            return this._data;
        },

        getShape: function () {
            var options = this.getData().options,
                shape = options.get('imageShape');

            if (shape) {
                return shape;
            }

            var offset = this.getOffset(),
                size = this.getSize();
            return new shapeRectangle(new pixelRectangle([
                [offset[0], offset[1]],
                [offset[0] + size[0], offset[1] + size[1]]
            ]));
        },

        getSize: function () {
            return this.getData().options.get('imageSize');
        },

        getOffset: function () {
            return this.getData().options.get('imageOffset', [0, 0]);
        },

        update: function () {
            this.events.fire('update');
        },

        isEmpty: function () {
            return true;
        },

        build: function () {
            this._monitor = new Monitor(this.getData().options).add(['imageHref', 'imageClipRect', 'imageSize', 'imageOffset'], this._setupBackground, this);
            this._setupBackground();
        },

        clear: function () {
            this._monitor.destroy();

            /*if (this._imageLoader) {
             this._imageLoader.removeAll();
             }*/
            this._image = null;
        },

        _setupBackground: function (values) {
            // Если сменился url картинки, не обрабатываем загрузку предыдущей.
            if (values && values.imageHref && this._imageLoader) {
                this._imageLoader.removeAll();
            }

            var imageHref = values ?
                utilHD.selectValue(values.imageHref) :
                utilHD.selectValue(this._monitor.get('imageHref'));

            imageLoader.load(imageHref, function (img, state) {
                this._image = img;
                this._imageSize = [
                    img.naturalWidth || img.width,
                    img.naturalHeight || img.height
                ];

                this._offscreenCanvas.width = this._imageSize[0];
                this._offscreenCanvas.height = this._imageSize[1];
                this._offscreenContext = null;

                this._clipRect = this.getData().options.get('imageClipRect', [
                    [0, 0],
                    [1024, 1024]
                ]);
                this._originalSize = [
                    this._clipRect[1][0] - this._clipRect[0][0],
                    this._clipRect[1][1] - this._clipRect[0][1]
                ];

                this.update();
            }, this);

        }
    });

    // оригинал - default#image
    layoutStorage.add("taxy#car", ImageLayout);
    provide(ImageLayout);
});

ymaps.modules.define('taxi.animation.utils', [
], function (provide) {
    provide({
        /**
         * Определяет наименьший угол поворота
         */
        getCssRotateDeg: function (prevDeg, deg) {
            var signP = prevDeg < 0 ? -1 : 1,
                signD = deg < 0 ? -1 : 1;

            // Если сторона совпадает - возвращаем
            if (signP === signD || prevDeg === 0) {
                return deg;
            }

            // Если цифра по модулю не изменилась
            if (Math.abs(prevDeg) === Math.abs(deg)) {
                return prevDeg;
            }

            // Если угол поворота меньше 180
            if (Math.abs(prevDeg - deg) <= 180) {
                return deg;
            }

            // Иначе добавляем разницу в текущему углу
            var angle = 360 - Math.abs(prevDeg) - Math.abs(deg);

            return (Math.abs(prevDeg) + angle) * signP;
        },

        getPointsFromSegments: function (segments) {
            var points = [];
            var coords;
            var cur;
            var prev;

            if (!segments) {
                throw new Error('segments is undefined');
            }

            /* jshint maxdepth:4 */
            // выполняю операцию для всех сегментов
            for (var i = 0, l = segments.length; i < l; i++) {
                // беру координаты начала и конца сегмента
                coords = segments[i].getCoordinates();
                // и добавляю каждую из них в массив, чтобы получить полный список точек
                for (var j = 0, k = coords.length; j < k; j++) {
                    cur = coords[j];
                    // пропускаем дубли
                    if (prev &&
                        prev[0].toPrecision(10) === cur[0].toPrecision(10) &&
                        prev[1].toPrecision(10) === cur[1].toPrecision(10)) {
                        continue;
                    }

                    points.push(cur);
                    prev = cur;
                }
            }

            return points;
        },

        /**
         * Градусы считаются от верхней части круга
         */
        getDirection: function (directions, deg) {
            var n = directions.length;
            var div = 360 / n;

            return directions[Math.round(deg / div) % n];

            //var n2 = this.n >> 1; // half of n
            //var number = (Math.round((Math.atan2(y, x) / Math.PI) * n2 + 1 / n) + n2) % n;
        }
    })
});

ymaps.modules.define('taxi.animation.waypoint', [
    'util.defineClass',
    'util.extend',
    'taxi.animation.utils'
], function (provide, defineClass, extend, utils) {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    var cancelRequestAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
        window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;

    function TaxiWaypointAnimation(geoObject, points, options) {
        this.lastAnimationTime = new Date().getTime();
        this.projection = geoObject.getMap().options.get('projection');
        this.points = points;
        this.pointsIndex = 1;
        this.currentPoint = points[0];
        this.deg = this.getRotationDegree(this.currentPoint, this.points[this.pointsIndex]);
        this.currentDeg = this.deg;
        this.dfd = ymaps.vow.defer();
        this.speed = options.distance / options.time;
        this.geoObject = geoObject;
        this.options = extend({
            speedFactor: 1
        }, options);
        this.tick = this.tick.bind(this);
        this.isRotation = !!options.rotationType;
        this.isDegRotation = options.rotationType === 'deg';
        this.isDirRotation = options.rotationType === 'dir';
    }

    defineClass(TaxiWaypointAnimation, {
        run: function () {
            this.animationFrame = requestAnimationFrame(this.tick);

            return this.dfd;
        },

        stop: function () {
            if (!this.animationFrame) {
                return;
            }

            cancelRequestAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        },

        pause: function () {
            if (!this.animationFrame) {
                return;
            }

            cancelRequestAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        },

        resume: function () {
            if (!this.animationFrame) {
                return;
            }

            this.run();
        },

        /**
         * Получаем следующую точку на отрезке
         */
        getNextPoint: function getNextPoint(from, to, distToMove) {
            // расстояние, которое нужно преодолеть
            var distToPoint = this.projection.getCoordSystem().distance(from, to);
            var nextPointCoords;

            // приблизились к точке B
            if (distToMove >= distToPoint) {
                nextPointCoords = to;
            } else {
                var prop = distToMove / distToPoint;
                var diffX = to[0] - from[0];
                var diffY = to[1] - from[1];

                nextPointCoords = [
                    (from[0] + (diffX * prop)),
                    (from[1] + (diffY * prop))
                ];
            }

            return nextPointCoords;
        },

        /**
         * Промежуточная точка поворота. Работает только с углами [0, 360]
         */
        getNextDeg: function (from, to, timeDiff) {
            if (from === to) {
                return to;
            }

            var direction = (from - to + 360) % 360 > 180 ? 1 : -1;
            var speed = 30;
            var dist = Math.max(5, Math.round(timeDiff / 1000 * speed)) * direction;
            var nextDeg = from + dist;
            if (nextDeg > 360) {
                nextDeg = nextDeg % 360;
            }

            if (direction === 1 && nextDeg >= to || direction === -1 && nextDeg <= to) {
                return to;
            }

            return nextDeg;
        },

        /**
         * Уровень поворота
         */
        getRotationDegree: function (from, to) {
            var fromToPixel = this.projection.toGlobalPixels(from, 10);
            var toToPixel = this.projection.toGlobalPixels(to, 10);
            var diffXPixel = fromToPixel[0] - toToPixel[0];
            var diffYPixel = fromToPixel[1] - toToPixel[1];

            // return Math.round(Math.atan2(diffYPixel, diffXPixel) * 180 / Math.PI) - 90;
            return (Math.round(Math.atan2(diffYPixel, diffXPixel) * 180 / Math.PI) + 270) % 360;
        },

        tick: function () {
            var now = new Date().getTime();
            var timeDiff = now - this.lastAnimationTime;
            var res;

            if (this.isRotation) {
                res = this.tickWithRotation(timeDiff);
            } else {
                res = this.tickSimple(timeDiff);
            }

            if (!res) {
                return;
            }

            this.lastAnimationTime = now;
            this.animationFrame = requestAnimationFrame(this.tick);
        },

        tickSimple: function (timeDiff) {
            // при смене окна в браузере, мы можем получить задержку, и нужно будет сменить более одной точки.
            var distToMove = this.speed * timeDiff / 1000 * this.options.speedFactor;
            var pointB;
            var isFinished = true;
            for (; this.pointsIndex < this.points.length; this.pointsIndex++) {
                pointB = this.points[this.pointsIndex];
                var distToPoint = this.projection.getCoordSystem().distance(this.currentPoint, pointB);

                if (distToMove <= distToPoint) {
                    isFinished = false;
                    break;
                }

                this.currentPoint = pointB;
                distToMove -= distToPoint;
            }

            if (isFinished) {
                this.dfd.resolve();
                this.animationFrame = null;
                return;
            }

            var nextPoint = this.getNextPoint(this.currentPoint, pointB, distToMove);

            this.geoObject.geometry.setCoordinates(nextPoint);
            this.currentPoint = nextPoint;

            return true;
        },

        tickWithRotation: function (timeDiff) {
            // при смене окна в браузере, мы можем получить задержку, и нужно будет сменить более одной точки.
            var distToMove = this.speed * timeDiff / 1000 * this.options.speedFactor;
            var pointB;
            var isFinished = true;
            for (; this.pointsIndex < this.points.length; this.pointsIndex++) {
                pointB = this.points[this.pointsIndex];
                this.deg = this.getRotationDegree(this.currentPoint, pointB);
                var distToPoint = this.projection.getCoordSystem().distance(this.currentPoint, pointB);

                if (distToMove <= distToPoint) {
                    isFinished = false;
                    break;
                }

                this.currentPoint = pointB;
                distToMove -= distToPoint;
            }

            if (isFinished) {
                this.dfd.resolve();
                this.animationFrame = null;
                return;
            }

            var nextPoint = this.getNextPoint(this.currentPoint, pointB, distToMove);
            var nextDeg = this.getNextDeg(this.currentDeg, this.deg, timeDiff);
            var direction = null;

            // перемещаем машинку
            this.geoObject.geometry.setCoordinates(nextPoint);

            // ставим машинке правильное направление и угол поворота
            if (this.isDegRotation) {
                this.geoObject.properties.set('deg', nextDeg);
                this.geoObject.options.set('iconImageRotation', nextDeg);
            } else if (this.isDirRotation) {
                this.geoObject.properties.set('direction', utils.getDirection(this.options.directions, nextDeg));
            }

            this.currentPoint = nextPoint;
            this.currentDeg = nextDeg;

            return true;
        }
    });

    provide(TaxiWaypointAnimation);
});

ymaps.modules.define('taxi.animation.controller', [
    'util.defineClass',
    'taxi.animation.utils',
    'taxi.animation.waypoint'
], function (provide, defineClass, utils, TaxiWaypointAnimation) {

    function TaxiAnimationController(geoObject, options) {
        this.geoObject = geoObject;
        this.options = options;

        if (options.rotationType === TaxiAnimationController.ROTATION_DIRECTIONS && !Array.isArray(options.directions)) {
            throw new Error('directions has not defined!');
        }
    }

    TaxiAnimationController.DIRECTION_4 = ['n', 'e', 's', 'w'];
    TaxiAnimationController.DIRECTION_8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    TaxiAnimationController.DIRECTION_16 = ['n', 'nne', 'ne', 'nee', 'e', 'see', 'se', 'sse', 's', 'ssw', 'sw', 'sww', 'w', 'nww', 'nw', 'nnw'];

    TaxiAnimationController.ROTATION_DEG = 'deg';
    TaxiAnimationController.ROTATION_DIRECTIONS = 'dir';

    defineClass(TaxiAnimationController, {
        /**
         * Анимируем по переданному пути
         * @param {ymaps.Path} path
         * @param {Object} [options]
         * @param {Number} [options.time] - время прохождения маршрута
         * @param {Number} [options.distance] - дистанция
         * @return {Promise}
         */
        moveOnPath: function (path, options) {
            var dfd = this._initDfd();

            this._moveOnPath(path, options).then(function (status) {
                dfd.resolve(status);
            }, function (er) {
                dfd.reject(er);
            });

            return dfd.promise();
        },

        /**
         * Анимируем от точки А к точке Б
         * @param {Array} points
         * @param {Object} options
         * @param {Number} options.time - время прохождения маршрута
         * @param {Number} options.distance - дистанция
         * @return {Promise}
         */
        moveOnPoint: function (points, options) {
            var dfd = this._initDfd();

            if (!options) {
                return dfd.reject(new Error('options is required'));
            }

            this._moveOnPoint(points, options).then(function (status) {
                dfd.resolve(status);
            }, function (er) {
                dfd.reject(er);
            });

            return dfd.promise();
        },

        /**
         * Анимация по маршруту (Набору путей)
         * @param {route} paths - Путь из роута route.getPaths();
         * @param {Object} [options]
         * @param {Number} [options.time] - Время прохождения пути (секунды)
         * @param {Number} [options.distance] - Дистанция (метры)
         */
        moveOnRoute: function (paths, options) {
            var dfd = this._initDfd();

            this._moveOnRouteStep(paths, 0, ymaps.util.extend({}, options, {
                startAnimationTime: new Date().getTime()
            })).then(function (status) {
                dfd.resolve(status);
            }, function (er) {
                dfd.reject(er);
            });

            return dfd.promise();
        },

        /**
         * Анимация по массиву точек
         * @param {Array} points
         * @param {Object} options
         * @param {Number} options.time - seconds
         * @param {Number} options.distance - meter
         * @returns {*}
         */
        moveOnPoints: function (points, options) {
            var self = this;

            this._initDfd();

            this._moveOnPointStep(points, 0, ymaps.util.extend({}, options, {
                startAnimationTime: new Date().getTime()
            })).then(function (status) {
                self._dfd.resolve(status);
            }, function (er) {
                self._dfd.reject(er);
            });

            return this._dfd.promise();
        },

        /**
         * Приостановить поездку.
         */
        pause: function () {
            if (!this._dfd || this._isResolved()) {
                return;
            }

            if (this.getState() !== 'moving') {
                return;
            }

            this._animation.pause();

            // ставим машинке правильное направление - в данном случае меняем ей текст
            this.geoObject.properties.set('state', 'stopped');
        },

        /**
         * Возобновить поездку.
         */
        resume: function () {
            if (!this._dfd || this._isResolved()) {
                return;
            }

            if (this.getState() === 'stopped') {
                this._runAnimation();
            }
        },

        /**
         * Останавливаем и чистим
         */
        abort: function () {
            if (!this._dfd || this._isResolved()) {
                return;
            }

            this._finished();
            this._dfd.resolve('aborted');
        },

        /**
         * Запросить состояние объекта
         * @returns {String}
         */
        getState: function () {
            return this.geoObject.properties.get('state');
        },

        _finished: function () {
            // clearTimeout(this._animateTimer);
            this._animation.stop();
            this.geoObject.properties.unset('state');
        },

        /**
         * Запускаем анимацию. Меняем по тику геометрию и properties Геообъекта
         *
         * @return {Promise}
         * @private
         */
        _runAnimation: function (points, options) {
            // Мы не можем запустить анимацию, если машинки нет на карте
            var map = this.geoObject.getMap();
            if (!map) {
                return this._dfd.reject(new Error('The car is not added to the map'));
            }

            // Чистим прошлый таймаут
            if (this._animation) {
                // clearTimeout(this._animateTimer);
                this._animation.stop();
            }

            this.geoObject.properties.set('state', 'moving');

            this._animation = new TaxiWaypointAnimation(this.geoObject, points, ymaps.util.extend({}, this.options, options));
            this._dfdTimer = this._animation.run();

            return this._dfdTimer.promise();
        },

        _isResolved: function () {
            if (this._dfd) {
                return this._dfd._promise.isResolved();
            }

            return true;
        },

        _initDfd: function () {
            var dfd = ymaps.vow.defer();

            if (!this._dfd || this._isResolved()) {
                this._dfd = dfd;
            }

            return this._dfd;
        },

        _moveOnPath: function (path, options) {
            options = ymaps.util.extend({
                distance: path.getLength(),
                time: path.getTime()
            }, options);

            var dfd = this._dfd;

            var segments = path.getSegments();
            if (!segments) {
                return dfd.reject(new Error('No Segments'));
            }

            var points = utils.getPointsFromSegments(segments);

            return this._runAnimation(points, options);
        },

        _moveOnPoint: function (points, options) {
            return this._runAnimation(points, options);
        },

        /**
         * @param {route} paths
         * @param {Number} index
         * @param {Object} [options]
         * @private
         */
        _moveOnRouteStep: function (paths, index, options) {
            var dfd = ymaps.vow.defer(),
                self = this;

            if (index === paths.getLength()) {
                return dfd.resolve();
            }

            var way = paths.get(index);

            return this._moveOnPath(way, options).then(function () {
                return self._moveOnRouteStep(paths, ++index, options);
            });
        },

        /**
         * @param {Array} points
         * @param {Number} index
         * @param {Object} options
         * @private
         */
        _moveOnPointStep: function (points, index, options) {
            var dfd = ymaps.vow.defer(),
                self = this;

            if (index >= points.length) {
                return dfd.resolve();
            }

            var startPoint = points[index],
                endPoint = points[index + 1];

            return this._moveOnPoint([startPoint, endPoint], options).then(function () {
                return self._moveOnPointStep(points, index += 2, options);
            });
        }
    });

    provide(TaxiAnimationController);
});

ymaps.modules.define('taxi.animation.geoObject.canvas.rotation', [
    'taxi.image_layout',
    'util.extend'
], function (provide, ImageLayout, extend) {
    provide(function (properties, options) {
        return new ymaps.GeoObject(properties, extend({
            iconLayout: {
                canvasLayout: 'taxy#car'
            },
            iconPixelPerfect: true,
            iconRenderMode: 'canvas', // some magic!
            interactivityModel: 'default#opaque'

            //'iconImageHref': 'img/car.svg',
            //'iconImageSize': [54, 54],
            //'iconImageOffset': [-27, -27]
        }, options));
    });
});

ymaps.modules.define('taxi.animation.geoObject.canvas.simple', [
    'layout.image.canvas',
    'util.extend'
], function (provide, ImageLayout, extend) {
    provide(function (properties, options) {
        return new ymaps.GeoObject(properties, extend({
            iconLayout: {
                canvasLayout: 'default#image'
            },
            iconPixelPerfect: true,
            iconRenderMode: 'canvas',
            interactivityModel: 'default#opaque'
        }, options));
    });
});

ymaps.modules.define('taxi.animation.geoObject.html.simple', [
    'util.extend'
], function (provide, extend) {
    provide(function (properties, options) {
        return new ymaps.GeoObject(properties, extend({
            iconLayout: ymaps.templateLayoutFactory.createClass(options.html),
            interactivityModel: 'default#opaque'
        }, options));
    });
});

ymaps.modules.define('taxi.animation.geoObject.html.rotation', [
    'util.extend',
    'taxi.animation.utils'
], function (provide, extend, utils) {
    provide(function (properties, options) {
        return new ymaps.GeoObject(properties, extend({
            iconLayout: ymaps.templateLayoutFactory.createClass(
                options.html,
                {
                    // По умолчанию при каждом изменение properties DOM элемент удаляется и строится новый. Нужно избавиться от этого
                    build: function () {
                        var geoObject = this.getData().geoObject;

                        if (this.builed) {
                        }

                        this.builed = true;
                        // необходим вызов родительского метода, чтобы добавить содержимое макета в DOM
                        this.constructor.superclass.build.call(this);

                        var elem = this.getElement().childNodes[0];
                        var prevDeg = 0;
                        var prevState;

                        geoObject.events.remove('propertieschange').add('propertieschange', function () {
                            var state = geoObject.properties.get('state');
                            var deg = geoObject.properties.get('deg') || 0;

                            if (deg > 180) {
                                deg -= 360;
                            }

                            if (prevDeg !== deg) {
                                deg = utils.getCssRotateDeg(prevDeg, deg);
                                elem.style['-webkit-transform'] = 'rotate(' + deg + 'deg)';
                                elem.style['-ms-transform'] = 'rotate(' + deg + 'deg)';
                                elem.style['transform'] = 'rotate(' + deg + 'deg)';

                                prevDeg = deg;
                            }

                            if (prevState !== state && state) {
                                // TODO IE8
                                elem.classList.remove('state_' + prevState);
                                elem.classList.add('state_' + state);
                                prevState = state;
                            }
                        });
                    }
                }
            ),
            interactivityModel: 'default#opaque'
        }, options));
    });
});

ymaps.modules.define('taxi.animation.geoObject.html.sprite', [
    'util.extend',
    'taxi.animation.utils'
], function (provide, extend) {
    provide(function (properties, options) {
        return new ymaps.GeoObject(properties, extend({
            iconLayout: ymaps.templateLayoutFactory.createClass(
                options.html,
                {
                    // По умолчанию при каждом изменение properties DOM элемент удаляется и строится новый. Нужно избавиться от этого
                    build: function () {
                        var geoObject = this.getData().geoObject;

                        if (this.builed) {
                            return;
                        }

                        this.builed = true;
                        // необходим вызов родительского метода, чтобы добавить содержимое макета в DOM
                        this.constructor.superclass.build.call(this);

                        var elem = this.getElement().childNodes[0];
                        var prevDir;
                        var prevState;

                        geoObject.events.remove('propertieschange').add('propertieschange', function () {
                            var state = geoObject.properties.get('state');
                            var dir = geoObject.properties.get('direction');

                            if (prevDir !== dir) {
                                // TODO IE8
                                elem.classList.remove('dir_' + prevDir);
                                elem.classList.add('dir_' + dir);

                                prevDir = dir;
                            }

                            if (prevState !== state && state) {
                                // TODO IE8
                                elem.classList.remove('state_' + prevState);
                                elem.classList.add('state_' + state);
                                prevState = state;
                            }
                        });
                    }
                }
            ),
            interactivityModel: 'default#opaque'
        }, options));
    });
});
