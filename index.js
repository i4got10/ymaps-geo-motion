/* global _, $, ymaps */

// Описываем класс машинки
function CarMotionModule(ymaps, options, properties) {
    "use strict";

    var ANIMATE_TIMEOUT = 50,
        MTS_KOEF = 10;

    /**
     * @param {Number} n
     * @constructor
     */
    function DirectionVariants (n) {
        this.n = n;

        this.classes = {
            16: ['w', 'sww', 'sw', 'ssw', 's', 'sse', 'se', 'see', 'e', 'nee', 'ne', 'nne', 'n', 'nnw', 'nw', 'nww'],
            8: ['w', 'sw', 's', 'se', 'e', 'ne', 'n', 'nw'],
            4: ['w', 's', 'e', 'n']
        };
    }

    /**
     * @param x
     * @param y
     * @returns {String}
     */
    DirectionVariants.prototype.getDirection = function (x, y) {
        var n = this.n,
            n2 = this.n >> 1; // half of n
        var number = (Math.floor(Math.atan2(x, y) / Math.PI * n2 + 1 / n) + n2) % n;
        return this.classes[n][number];
    };

    /**
     * @param segments
     */
    function getPointsFromSegments (segments) {
        // открываю массив с точками
        var points = [],
            coords,
            cur,
            prev;

        // выполняю операцию для всех сегментов
        for (var i = 0, l = segments.length; i < l; i++) {
            // беру координаты начала и конца сегмента
            coords = segments[i].getCoordinates();
            // и добавляю КАЖДУЮ ИЗ НИХ в массив, чтобы получить полный список точек
            for (var j = 0, k = coords.length; j < k; j++) {
                cur = coords[j];
                // пропускаем дубли
                if (prev && prev[0].toPrecision(10) === cur[0].toPrecision(10) && prev[1].toPrecision(10) === cur[1].toPrecision(10)) {
                    continue;
                }

                points.push(cur);
                prev = cur;
            }
        }

        return points;
    }

    // нормализуем в один массив точек сегметны из ymaps
    function makeWayPointsFromSegments (segments, stepSpacing, coordSystem) {
        options = options || {};

        var street,
            wayList = [],
            // вспомогательные
            i, j, l,
            directionsVariants = new DirectionVariants(8);

        // открываю массив с точками
        var points = getPointsFromSegments(segments);

        // строим путь. берем 1 единицу расстояния, возвращаемого distance, за пройденный путь в единицу времени. в 1 единица времени - будет 1 смещение геоточки. ни разу не оптимальный, но наглядный алгоритм
        for (i = 0, l = points.length - 1; l; --l, ++i) {
            var from = points[i],
                to = points[i + 1],
                diffX = to[0] - from[0],
                diffY = to[1] - from[1];

            var direction = directionsVariants.getDirection(diffX, diffY),
                dist = Math.round(coordSystem.distance(from, to)),
                prop;

            // каждую шестую, а то слишком медленно двигается. чрезмерно большая точность
            for (j = 0; j < dist; j += stepSpacing) {
                prop = j / dist;
                wayList.push({
                    coords: [
                        from[0] + (diffX * prop),
                        from[1] + (diffY * prop)
                    ],
                    direction: direction,
                    vector: [diffX, diffY]
                });
            }
        }

        return wayList;
    }

    var GeoMotionConstructor = function (properties, options) {
        // Вызываем конструктор родителя
        GeoMotionConstructor.superclass.constructor.call(this, properties, options);

        this.waypoints = [];
    };

    ymaps.util.augment(GeoMotionConstructor, ymaps.GeoObject, {
        /**
         * @param {ymaps.Path} path
         * @param {Function} fnComplete
         * @return {Promise}
         */
        moveOnPath: function (path, fnComplete) {
            var segments = path.getSegments();
            if (!segments) {
                return;
            }

            var pathLength = path.getLength(),
                pathTime = path.getTime(),
                step = pathLength / pathTime;

            var coordSystem = this.getMap().options.get('projection').getCoordSystem();

            var stepSpacing = step / (1000 / ANIMATE_TIMEOUT) * MTS_KOEF;

            // Получаем точечки
            this.waypoints = makeWayPointsFromSegments(segments, stepSpacing, coordSystem);

            return this._runAnimation(fnComplete);
        },

        /**
         * @return {Promise}
         * @private
         */
        _runAnimation: function () {
            var self = this,
                dfd = $.Deferred();

            this._animateTimer = setInterval(function () {
                // если точек больше нет - значит приехали
                if (self.waypoints.length === 0) {
                    clearTimeout(self._animateTimer);
                    dfd.resolve(self);
                    return;
                }

                // берем следующую точку
                var nextPoint = self.waypoints.shift();

                // перемещаем машинку
                self.geometry.setCoordinates(nextPoint.coords);
                // ставим машинке правильное направление - в данном случае меняем ей текст
                self.properties.set('direction', nextPoint.direction);
            }, ANIMATE_TIMEOUT);

            return dfd.promise();
        }
    });

    return new GeoMotionConstructor(options, properties);
}


// Как только будет загружен API и готов DOM, выполняем инициализацию
ymaps.ready(function () {
    "use strict";

    var map = new ymaps.Map("map", {
        center: [55.75, 37.62], // ~msk
        zoom: 10
    });

    var car = new CarMotionModule(ymaps, {
        // Описываем геометрию типа "Точка".
        geometry: {
            type: "Point",
            coordinates: [55.75062, 37.62561]
        }
    }, {
        iconLayout: ymaps.templateLayoutFactory.createClass('<div class="b-car b-car-direction-$[properties.direction]"></div>'),
        preset: 'twirl#greenStretchyIcon'
    });

    ymaps.route(
        [
            'Москва, метро Смоленская',
            [55.810532, 37.605693] // и до метро "Третьяковская"
        ], {
            // Опции маршрутизатора
            mapStateAutoApply: true // автоматически позиционировать карту
        }
    ).then(
        function (route) {
            // Задание контента меток в начальной и конечной точках
            var points = route.getWayPoints();
            points.get(0).properties.set("iconContent", "А");
            points.get(1).properties.set("iconContent", "Б");

            var path = route.getPaths().get(0);

            // Добавление маршрута на карту
            map.geoObjects.add(route);
            // И "машинку" туда же
            map.geoObjects.add(car);

            car.moveOnPath(path).then(function (car) {
                car.properties.set('balloonContent', "Приехали!");
                car.balloon.open();
            });

        }, function (error) {
            console.error("Возникла ошибка: " + error.message);
        });
});
