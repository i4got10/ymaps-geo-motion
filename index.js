ymaps.ready(function () {
    setTimeout(buildMap, 0);
});

function runCarCanvasSimple(map, route) {
    ymaps.modules.require([
            'taxi.animation.geoObject.canvas.simple',
            'taxi.animation.controller'
        ], function (CanvasSimpleGeoObject, AnimationController) {
            var canvasCar = new CanvasSimpleGeoObject({
                geometry: {
                    type: 'Point',
                    coordinates: [55.7571, 37.61681]
                }
            }, {
                iconImageHref: 'img/carIcon.png',
                iconImageSize: [16, 16],
                iconImageOffset: [-8, -8]
            });

            var controller = new AnimationController(canvasCar, {
                speedFactor: 10
            });

            map.geoObjects.add(canvasCar);

            var paths = route.getPaths();

            return controller.moveOnRoute(paths);
        })
        .done();
}

function runCarCanvasRotation(map, route) {
    ymaps.modules.require([
            'taxi.animation.geoObject.canvas.rotation',
            'taxi.animation.controller'
        ], function (CanvasRotationGeoObject, AnimationController) {
            var canvasCar = new CanvasRotationGeoObject({
                geometry: {
                    type: 'Point',
                    coordinates: [55.7571, 37.61681]
                }
            }, {
                iconImageHref: 'img/car.svg',
                iconImageSize: [54, 54],
                iconImageOffset: [-27, -27]
            });

            var controller = new AnimationController(canvasCar, {
                speedFactor: 10,
                rotationType: AnimationController.ROTATION_DEG
            });

            map.geoObjects.add(canvasCar);

            var button = new ymaps.control.Button({data: {content: 'pause'}, options: {maxWidth: [200], selectOnClick: false}});
            map.controls.add(button, {float: 'left'});

            button.events.add('click', function () {
                controller.pause();
            });

            return controller.moveOnRoute(route.getPaths());
        })
        .done();
}

function runCarHtmlSimple(map, route) {
    ymaps.modules.require([
            'taxi.animation.geoObject.html.simple',
            'taxi.animation.controller'
        ], function (HtmlSimpleGeoObject, AnimationController) {
            var canvasCar = new HtmlSimpleGeoObject({
                geometry: {
                    type: 'Point',
                    coordinates: [55.7571, 37.61681]
                }
            }, {
                html: '<div class="car"></div>',
                // iconImageSize: [54, 54],
                iconImageOffset: [-27, -27]
            });

            var controller = new AnimationController(canvasCar, {
                speedFactor: 10
            });

            map.geoObjects.add(canvasCar);

            return controller.moveOnRoute(route.getPaths());
        })
        .done();
}

function runCarHtmlRotation(map, route) {
    ymaps.modules.require([
            'taxi.animation.geoObject.html.rotation',
            'taxi.animation.controller'
        ], function (HtmlRotationGeoObject, AnimationController) {
            var canvasCar = new HtmlRotationGeoObject({
                geometry: {
                    type: 'Point',
                    coordinates: [55.7571, 37.61681]
                }
            }, {
                html: '<div class="car"></div>',
                // iconImageSize: [54, 54],
                iconOffset: [-27, -27]
            });

            var controller = new AnimationController(canvasCar, {
                speedFactor: 10,
                rotationType: AnimationController.ROTATION_DEG
            });

            map.geoObjects.add(canvasCar);

            return controller.moveOnRoute(route.getPaths());
        })
        .done();
}

function buildMap() {
    var map = new ymaps.Map('map', {
        center: [55.7571, 37.61681], // ~msk
        zoom: 17,
        controls: []
    });

    var button1 = new ymaps.control.Button({data: {content: 'Canvas: Без учета направления'}, options: {maxWidth: [200], selectOnClick: false}});
    var button2 = new ymaps.control.Button({data: {content: 'Canvas: С учетом направления'}, options: {maxWidth: [200], selectOnClick: false}});
    var button3 = new ymaps.control.Button({data: {content: 'Html: Без учета направления'}, options: {maxWidth: [200], selectOnClick: false}});
    var button4 = new ymaps.control.Button({data: {content: 'Html(css3): С учетом направления'}, options: {maxWidth: [200], selectOnClick: false}});
    var button5 = new ymaps.control.Button({data: {content: 'Html(sprite): С учетом направления'}, options: {maxWidth: [200], selectOnClick: false}});

    ymaps
        .route(
            [
                [55.7571, 37.61681],
                [55.7871, 37.58681],
                [55.7971, 37.64681],
                [55.7271, 37.70681]
            ]
        )
        .then(function (route) {
            // Задание контента меток в начальной и конечной точках
            var points = route.getWayPoints();
            points.get(0).properties.set('iconContent', 'А');
            points.get(1).properties.set('iconContent', 'Б');

            var paths = route.getPaths();

            paths.options.set({
                strokeColor: '110000ff',
                opacity: 0.4
            });

            map.geoObjects.add(route);

            map.controls.add(button1, {float: 'right'});
            map.controls.add(button2, {float: 'right'});
            map.controls.add(button3, {float: 'right'});
            map.controls.add(button4, {float: 'right'});
            map.controls.add(button5, {float: 'right'});

            button1.events.add('click', runCarCanvasSimple.bind(null, map, route));
            button2.events.add('click', runCarCanvasRotation.bind(null, map, route));
            button3.events.add('click', runCarHtmlSimple.bind(null, map, route));
            button4.events.add('click', runCarHtmlRotation.bind(null, map, route));
        }).done();
}
