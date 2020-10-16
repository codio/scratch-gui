const util = require('util');
const Bluebird = require('bluebird');
const fs = require('fs');
const path = require('path');
const S3 = require('aws-sdk/clients/s3');
const _ = require('lodash');

const mapsPrefix = 'internal-maps';

/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
async function walk (dir, fileList = []) {
    const readdir = util.promisify(fs.readdir);
    const files = await readdir(dir);
    for (const file of files) {
        const fsStat = util.promisify(fs.stat);
        const stat = await fsStat(path.join(dir, file));
        if (stat.isDirectory()) fileList = await walk(path.join(dir, file), fileList);
        else fileList.push(path.join(dir, file));
    }
    return fileList;
}

const getClient = (key, secret) => {
    return new S3({
        apiVersion: '2006-03-01',
        params: {
            Bucket: 'codio-assets'
        },
        accessKeyId: key,
        secretAccessKey: secret,
        region: 'us-east-1'
    });
};

/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
function getContentType (fileName) {
    let extn = fileName.split('.').pop();
    let contentType;
    switch (extn) {
    case 'html':
    case 'css':
        contentType = 'text/' + extn
        break;
    case 'js':
        contentType = 'application/javascript';
        break;
    case 'png':
    case 'jpg':
    case 'gif':
        contentType = 'image/' + extn;
        break;
    case 'jpeg':
        contentType = 'image/jpg';
        break;
    case 'svg':
        contentType = 'image/svg+xml';
        break;
    case 'ttf':
    case 'woff':
    case 'woff2':
        contentType = 'font/' + extn;
        break;
    case 'eot':
        contentType = 'application/vnd.ms-fontobject';
        break;
    default:
        contentType = 'application/octet-stream';
    }
    return contentType;
}

/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
async function upload (s3path, buildDir, files, key, secret) {
    const s3Client = getClient(key, secret);
    if (files) {
        const buildDirPattern = new RegExp(`^${buildDir}`);
        return Bluebird.map(files, fileName => {
            const fileContent = fs.readFileSync(fileName);
            return s3Client.upload({
                Key: fileName.replace(buildDirPattern, s3path),
                Body: fileContent,
                ContentType: getContentType(fileName)}
            ).promise();
        }, {concurrency: 5});
    }
}

(async function () {
    const [s3path, buildDir, key, secret] = process.argv.slice(2);

    const excluded = [
        path.join(buildDir, 'index.html'),
        path.join(buildDir, 'rev-manifest-fonts.json'),
        path.join(buildDir, 'rev-manifest-less.json'),
        path.join(buildDir, 'rev-manifest-images.json'),
        path.join(buildDir, 'codio-client.js'),
        path.join(buildDir, 'connectivity'),
        path.join(buildDir, 'ext', 'iframe')
    ];

    const files = await walk(path.join('.', buildDir));
    const groupedFiles = _.groupBy(files, file => {
        if (_.some(excluded, excludedItem => {
            return _.startsWith(file, excludedItem);
        })) {
            return 'excluded';
        } else if (path.extname(file) === '.map') {
            return 'sourcemap';
        } else {
            return 'source';
        }
    });

    try {
        // upload source files
        await upload(s3path, buildDir, groupedFiles.source, key, secret);
        // upload source maps
        await upload(`${mapsPrefix}/${s3path}`, buildDir, groupedFiles.sourcemap, key, secret);
    } catch (err) {
        /* eslint-disable no-unused-expressions */
        /* eslint-disable no-console */
        err && console.log(err.message);
        process.exitCode = 1;
    }
}())
