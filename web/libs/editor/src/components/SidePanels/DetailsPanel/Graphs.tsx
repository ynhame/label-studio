/* usefull links:
  api documentation:
    https://echarts.apache.org/en/api.html#echarts

  how to change the plot symbols:
    https://echarts.apache.org/examples/en/editor.html?c=line-style

  reference plot:
    https://echarts.apache.org/examples/en/editor.html?c=area-simple

  apache echarts react component:
    https://www.npmjs.com/package/echarts-for-react

  chart options api reference:
    https://echarts.apache.org/en/option.html#title

  example with multiple plots:
    https://echarts.apache.org/examples/en/editor.html?c=candlestick-brush&edit=1&reset=1

  example with confidence band:
    https://echarts.apache.org/examples/en/editor.html?c=confidence-band

  TODO: example with multiple plots changing dinamically:
    https://echarts.apache.org/examples/en/editor.html?c=scatter-nutrients-matrix&reset=1&edit=1
 */

import { types, flow } from 'mobx-state-tree';
import { observer } from 'mobx-react';
import React from 'react';
import ReactECharts from 'echarts-for-react';
// import * as echarts from 'echarts';

const dataValues = types.model({
    date: types.Date,
    Q1: types.number,
    median: types.number,
    mean: types.number,
    Q3: types.number,
}).views(self => ({
    formatDate() {
      const meses = [ "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez" ]
      const month = meses[self.date.getMonth()];
      const year = self.date.getFullYear(); 
      return `${month}/${year}`
    }
  })
)

const plotData = types.model({
  name: types.string,
  values : types.array(dataValues),
}).views(self => ({
  get make_options() {

    const date = []
    const Q1 = []
    const median = []
    const mean = []
    const Q3 = []
    for (const value of self.values) {
      date.push(value.formatDate())
      Q1.push(value.Q1)
      median.push(value.median)
      mean.push(value.mean)
      Q3.push(value.Q3)
    }
     

    const options = {
      animationDuration: false,
      tooltip: {
        trigger: 'axis',
        position: (pt: Array<object>) => [pt[0], '10%']
      },
      title: {
        left: 'center',
        text: self.name,
      },
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'valor'
          },
          restore: {},
          saveAsImage: {}
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: date
      },
      yAxis: {
        type: 'value',
        boundaryGap: [0, '100%'],
        min: 0,
        max: 100
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          start: 0,
          end: 10
        }
      ],
      series: [
        {
          name: 'Q1',
          data: Q1,
          type: 'line',
          sampling: 'lttb',
          itemStyle: { color: 'rgb(70, 255, 131)' },
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none',
        },
        {
          name: 'median',
          data: median,
          type: 'line',
          symbol: 'circle',
          simbolSize: 100,
          sampling: 'lttb',
          itemStyle: {
            color: 'rgb(70, 255, 50)'
          },
          lineStyle: { width: 5 },
        },
        {
          name: 'Q3',
          data: Q3,
          type: 'line',
          sampling: 'lttb',
          itemStyle: { color: 'rgb(70, 255, 131)' },
          lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgb(70, 255, 131)', opacity: 0.5 },
          stack: 'confidence-band',
          symbol: 'none',
        },
        /* {
          name: 'mean',
          type: 'line',
          symbol: 'triangle',
          simbolSize: 40,
          sampling: 'lttb',
          itemStyle: {
            color: 'rgb(255, 70, 131)'
          },
          data: mean
        } */
      ]
    };
    return options
  }
}))

const rawPoint = types.model({
  id: types.identifier,
  points: types.array(types.array(types.number)),
  label: types.string,
}).views(self => ({
    get JSON(){
      return JSON.stringify(self)
    }
  })
)

function adapter(obj) {
  return plotData.create({
    name: obj.name,
    values: obj.values.map((e: [string, number, number, number, number]) => dataValues.create({
      date: new Date(e[0]),
      Q1: e[1],
      median: e[2],
      mean: e[3],
      Q3: e[4],
    }))
  })
}

// https://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
function arrIdentical(a1, a2) {
    // Tim Down: http://stackoverflow.com/a/7837725/308645
    let i = a1.length;
    if (i !== a2.length) return false;
    while (i--) {
        if (a1[i] !== a2[i]) return false;
    }
    return true;
}

const plotStore = types.model({
  plots: types.array(plotData),
  rawPoints: types.array(rawPoint)
}).actions((self) => {
    function updateRawPoints(raw_points: Array<any>) {
      self.rawPoints = raw_points.map(e => rawPoint.create({
       id: e.id,
       points: e.value.points,
       label: e.value.polygonlabels[0]
      }))
    }
    const fetchProjects = flow(function* (rawPoints) {
     console.log('entrei na função que faz o fetch')

      const url = 'metrics'

      const raw_id = rawPoints.flatMap(e => e.id)
      const raw_labels = rawPoints.flatMap(e => e.value.polygonlabels[0])
      const raw_points = rawPoints.flatMap(e => e.value.points)
      if ( arrIdentical(raw_id, plotstore.rawPoints.map(e => e.id))) {
        console.log("as ids são as mesmas")
        return
      }
      if (arrIdentical(raw_labels, plotstore.rawPoints.map(e => e.label))){
        console.log("as lables são as mesmas")
        return
      } 
      if (arrIdentical(raw_points, plotstore.rawPoints.map(e => e.points))) {
        console.log("0s pontos são os mesmos")
        return
      } 

      updateRawPoints(rawPoints)

      try {
        self.plots = yield fetch(url, {
          headers : {
            'Content-Type' : 'application/json'
          },
          method: 'POST',
          body: JSON.stringify(self.rawPoints)
        })
        .then(response => response.json())
        .then(obj => {
          return obj.response.map(e => adapter(e))
        })
      } catch (error) { 
          console.error("Failed to fetch projects", error)
      }
    })
  return {fetchProjects}
}).views(self => ({
  get options() {
    if (self.plots.length === 0  ){return [[null, null]]}
    return self.plots.map(e => [e.name, e.make_options])
  },
  get length(){
    return self.plots.length
  },
  
}))

const plotstore = plotStore.create({
    plots : [],
    rawPoints : []
})

const Graph: React.FC<any> = observer(({raw_points}) => {
    console.log('entrei no gráfico')


    console.log("raw points:")
    console.log(raw_points[0])
  if (raw_points[0] !== undefined){
    plotstore.fetchProjects(raw_points[0])
  } else {
    console.log("nenhuma região selecionada")
  }

  const plotOptions = plotstore.options[0][1]

  return plotOptions
    ? <ReactECharts option={ plotOptions } />
    : <></>//<p> algo deu errado </p>

});

// function get_dummy_data() {
//     const plot_data: Array<[date: string, value: number]> = [
//       ["2019-01-01",  87],
//       ["2019-02-01",  97],
//       ["2019-03-04",  81],
//       ["2019-04-04",  67],
//       ["2019-05-05",  15],
//       ["2019-06-05",  69],
//       ["2019-07-06",  49],
//       ["2019-08-06",  58],
//       ["2019-09-06",  49],
//       ["2019-10-07",  94],
//       ["2019-11-07",  25],
//       ["2019-12-08",  56],
//       ["2020-01-08",  9],
//       ["2020-02-08",  86],
//       ["2020-04-10",  13],
//       ["2020-05-11",  60],
//       ["2020-06-11",  6],
//       ["2020-07-12",  27],
//       ["2020-08-12",  16],
//       ["2020-09-12",  66],
//       ["2020-11-13",  55],
//       ["2020-12-14",  62],
//       ["2021-01-14",  51],
//       ["2021-02-14",  6],
//       ["2021-03-17",  37],
//       ["2021-04-17",  13],
//       ["2021-06-18",  84],
//       ["2021-07-19",  4],
//       ["2021-08-19",  31],
//       ["2021-09-19",  35],
//       ["2021-10-20",  13],
//       ["2021-11-20",  99],
//       ["2021-12-21",  32],
//       ["2022-01-21",  90],
//       ["2022-02-21",  84],
//       ["2022-03-24",  60],
//       ["2022-04-24",  23],
//       ["2022-05-25",  76],
//       ["2022-06-25",  25],
//       ["2022-07-26",  88],
//       ["2022-08-26",  12],
//       ["2022-09-26",  13],
//       ["2022-10-27",  55],
//       ["2022-11-27",  59],
//       ["2022-12-28",  99]
//     ]

//   const to_plot_data = plotData.create({
//     name: "NDVI",
//     values: plot_data.map((e: [string, number]) => dataValues.create({
//       date: new Date(e[0]),
//       Q1: e[1] - Math.random()*5,
//       median: e[1],
//       mean: e[1] - Math.random(),
//       Q3: e[1]- Math.random()*5,
//     }))
//   });

//   return to_plot_data.make_options;
// }

// const Graph: React.FC<any> = observer(({raw_points}) => {

//     console.log("dummy data")
//     console.log(get_dummy_data())

//     return <ReactECharts option={ get_dummy_data() } />
// });

export default Graph;

