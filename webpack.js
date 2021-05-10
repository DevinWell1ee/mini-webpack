const fs = require('fs')
const path = require('path')

const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

// 模块分析
function getModuleInfo(file) {
    // 读取文件
    const body = fs.readFileSync(file, 'utf-8')


    // 转换ast
    // 将一个代码字符串转为一个对象
    const ast = parser.parse(body, {
        sourceType: 'module' // es模块
    })


    // 收集依赖
    const deps = {}
    traverse(ast, {
        ImportDeclaration({node}) {
            const dirname = path.dirname(file)
            const abspath = './' + path.join(dirname, node.source.value)
            deps[node.source.value] = abspath
        }
    })

    console.log('deps:', deps);

    // es6转换es5

    const { code } = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
    })

    console.log('code:', code)

    // 组装
    const moduleInfo = {
        file,
        deps,
        code
    }

    return moduleInfo
}

console.log('info:', getModuleInfo('./src/index.js'))

function parseModules(file){
    // 基于入口
    const entry = getModuleInfo(file)

    const temp = [entry]

    // 　依赖关系图
    const depsGraph = {}

    getDeps(temp, entry)

    // 组装依赖

    temp.forEach(info => {
        depsGraph[info.file] = {
            deps: info.deps,
            code: info.code
        }
    })

    return depsGraph
}

function getDeps(temp, { deps }) {
    Object.keys(deps).forEach(key => {
        const child = getModuleInfo(deps[key])

        temp.push(child)

        //  递归
        getDeps(temp, child)
    })
}

const graph = parseModules('./src/index.js')
console.log('graph:', graph)


function bundle(file) {
    const depsGraph = JSON.stringify(parseModules(file))

    return `(function (graph) {
                function require(file) {
                    function absRequire(relPath) {
                        return require(graph[file].deps[relPath])
                    }
                    var exports = {};

                    (function (require,exports,code) {
                        eval(code)
                    })(absRequire,exports,graph[file].code)
                    return exports
                }
                require('${file}')
            })(${depsGraph})`;
}

console.log('bundle:', bundle('./src/index.js'))

// 写入dist
!fs.existsSync('./dist') && fs.mkdirSync('./dist')

fs.writeFileSync('./dist/bundle.js', bundle('./src/index.js'))