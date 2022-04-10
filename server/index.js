const http = require('http'),
    fs = require('fs').promises,
    formidable = require('formidable'),
    url = require('url'),
    svgexport = require('svgexport');

function parseRequest(request) {
    const form = new formidable.IncomingForm();
    return new Promise((resolve, reject) => {
        form.parse(request, function(err, fields, files) {
            resolve({'err': err, 'fields': fields, 'files': files});
        });
    });
}

function svgExportAsync(dataFilename) {
    return new Promise((resolve, reject) => {
        svgexport.render(dataFilename, function(err) {
            if (typeof err === 'undefined') {
                resolve();
            } else {
                reject(err);
            }
        });
    });
}

const requestListener = async function(req, res) {
    const realUrl = url.parse(req.url).pathname;
    if (realUrl !== '/process') {
        res.writeHead(404);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(400);
        res.end();
        return;
    }

    try {
        const parsed = await parseRequest(req);
        if (typeof parsed.files.file === 'undefined') {
            throw new Error('Field `file` is empty or malformed');
        }

        const svgFilename = parsed.files.file.filepath + '.svg';
        console.info(svgFilename);
        await fs.rename(parsed.files.file.filepath, svgFilename);

        const dataFilename = '/tmp/svgexport-datafile-' + Math.random() + '.json';
        const pngFilename = '/tmp/svgexport-result-' + Math.random() + '.png';

        await fs.writeFile(dataFilename, JSON.stringify([
            {
                "input": [svgFilename],
                "output": [[pngFilename]]
            }
        ]));

        await svgExportAsync(dataFilename);
        console.info('File exported from ', svgFilename, 'to', pngFilename);
        const pngData = await fs.readFile(pngFilename);

        await fs.unlink(dataFilename);
        await fs.unlink(svgFilename);
        await fs.unlink(pngFilename);

        if (parsed.fields.type === 'json') {
            res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
            res.write(JSON.stringify({
                'result': pngData.toString('base64')
            }));
            res.end();
        } else {
            res.writeHead(200, {'Content-Type': 'image/png'});
            res.write(pngData);
            res.end();
        }
    } catch (e) {
        console.warn(e);

        res.writeHead(500, {'Content-Type': 'text/json; charset=utf-8'});
        res.write(JSON.stringify({
            'error': e + ''
        }));
        res.end();
    }
}

const server = http.createServer(requestListener);
server.listen(8080);
