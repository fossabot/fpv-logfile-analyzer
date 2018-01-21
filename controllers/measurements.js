/*
 * One Controller per layout view
 */

const express = require('express');
const router = express.Router();
const formidable = require('formidable');
const path = require('path');
const fs = require('promisify-fs');
const analyzer = require('../lib/index');
const measurementsModel = require('../models/measurement.model');

/* https://gist.github.com/paambaati/db2df71d80f20c10857d */
const handleFileUpload = file => {
    let oldPath = file.path;
    let fileSize = file.size;
    let fileName = file.name;
    let inputPath = path.join('logs', fileName);
    let newPath = path.join(process.env.PWD, inputPath);

    return fs.readFile(oldPath).then(data => {
        return fs.writeFile(newPath, data).then(_ => {
            return fs.delFile(oldPath).then(_ => {
                return inputPath;
            });
        });
    });
};

// Measurements
router.get('/', function(req, res, next) {
    return measurementsModel.find({}).then(result => {
        return res.render('measurements/measurements-overview', {
            title: 'Messungen',
            measurements: result
        });
    });
});

router.get('/add/', function(req, res, next) {
    return res.render('measurements/measurement-add', {
        title: 'Messung hinzufügen',
        dataPointMethodOptions: analyzer.getDataPointFunctionNames,
    });
});

router.get('/:id/', function(req, res, next) {
    return measurementsModel.findOne({ _id: req.params.id }).then(result => {
        return analyzer.writeDiagram(result, true).then(diagram => {
            return res.render('measurements/measurement', {
                title: result.label,
                measurement: result,
                chartDiv: diagram.chartDiv
            });
        });
    }).catch(err => res.send(err))
});

router.post('/', function(req, res, next) {

    let form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {

        handleFileUpload(files.file).then(inputFile => {

            analyzer.build({
                inputFile,
                dataFactor: parseInt(fields.dataFactor),
                fetchEnergy: fields.fetchEnergy === 'fetchEnergy' ? true : false,
                dataPointsMethod: parseInt(fields.dataPointsMethod)
            });

            analyzer.readFile(true).then(result => {
                let newMeasurement = new measurementsModel({
                    label: fields.label,
                    logFile: inputFile,
                    socket: result.chartTitle,
                    chartData: result.chartData,
                    statistics: result.statistics
                });

                return newMeasurement.save().then(result => {
                    res.redirect('/measurements/');
                }).catch(err => res.send(err));
            });
        });
    });
});

router.delete('/:id/', function(req, res, next) {
    return measurementsModel.find({ _id: req.params.id }).remove().then(result => {
        // delete logfile
        return fs.delFile(req.query.logFile).then(_ => {
            res.sendStatus(200);
        });
    });
});

module.exports = router;