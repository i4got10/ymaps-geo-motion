ymaps.ready(function () {
    setTimeout(buildMap, 0);
});

function buildMap() {
    var map = new ymaps.Map("map", {
        center: [55.7571, 37.61681], // ~msk
        zoom: 17,
        controls: []
    });

    ymaps.modules.require([
        'taxi.animation.geoObject.canvas',
        'taxi.animation.controller'
    ], function (CanvasGeoObject, AnimationController) {
        var canvasCar = new CanvasGeoObject({
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
            rotation: AnimationController.ROTATION_DEG,
            directions: AnimationController.DIRECTION_16
        });

        map.geoObjects.add(canvasCar);

        //ymaps.route(
        //    [
        //        'Москва, метро Смоленская',
        //        [55.810532, 37.605693] // и до метро "Третьяковская"
        //    ], {
        //        // Опции маршрутизатора
        //        mapStateAutoApply: true // автоматически позиционировать карту
        //    }
        //)

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
                points.get(0).properties.set('iconContent', "А");
                points.get(1).properties.set('iconContent', "Б");

                var paths = route.getPaths();

                paths.options.set({
                    strokeColor: '110000ff',
                    opacity: 0.4
                });

                map.geoObjects.add(route);

                return controller.moveOnRoute(paths);
            })
            .done();
    }).done();
}
