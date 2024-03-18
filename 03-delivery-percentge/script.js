function readCSVFile() {
    var files = document.querySelector("#file").files; // select file from input field
    if (files.length > 0) {
        // Selected file
        var file = files[0];
        Papa.parse(file, {    // papa.parse library to convert csv data to json data
            complete: function (results) {
                createChart(results.data);  //function calling
            },
        });
    }
}
function createChart(csvdata) {
    function addPopupEvents(chart) {
        const closePopupButtons = document.getElementsByClassName('highcharts-close-popup');
        // Close popup button:
        Highcharts.addEvent(
            closePopupButtons[0],
            'click',
            function () {
                this.parentNode.style.display = 'none';
            }
        );

        Highcharts.addEvent(
            closePopupButtons[1],
            'click',
            function () {
                this.parentNode.style.display = 'none';
            }
        );

        // Add an indicator from popup
        Highcharts.addEvent(
            document.querySelectorAll('.highcharts-popup-indicators button')[0],
            'click',
            function () {
                const typeSelect = document.querySelectorAll(
                    '.highcharts-popup-indicators select'
                )[0],
                    type = typeSelect.options[typeSelect.selectedIndex].value,
                    period = document.querySelectorAll(
                        '.highcharts-popup-indicators input'
                    )[0].value || 14;

                chart.addSeries({
                    linkedTo: 'aapl-ohlc',
                    type: type,
                    params: {
                        period: parseInt(period, 10)
                    }
                });

                chart.stockToolbar.indicatorsPopupContainer.style.display = 'none';
            }
        );

        // Update an annotaiton from popup
        Highcharts.addEvent(
            document.querySelectorAll('.highcharts-popup-annotations button')[0],
            'click',
            function () {
                const strokeWidth = parseInt(
                    document.querySelectorAll(
                        '.highcharts-popup-annotations input[name="stroke-width"]'
                    )[0].value,
                    10
                ),
                    strokeColor = document.querySelectorAll(
                        '.highcharts-popup-annotations input[name="stroke"]'
                    )[0].value;

                // Stock/advanced annotations have common options under typeOptions
                if (chart.currentAnnotation.options.typeOptions) {
                    chart.currentAnnotation.update({
                        typeOptions: {
                            lineColor: strokeColor,
                            lineWidth: strokeWidth,
                            line: {
                                strokeWidth: strokeWidth,
                                stroke: strokeColor
                            },
                            background: {
                                strokeWidth: strokeWidth,
                                stroke: strokeColor
                            },
                            innerBackground: {
                                strokeWidth: strokeWidth,
                                stroke: strokeColor
                            },
                            outerBackground: {
                                strokeWidth: strokeWidth,
                                stroke: strokeColor
                            },
                            connector: {
                                strokeWidth: strokeWidth,
                                stroke: strokeColor
                            }
                        }
                    });
                } else {
                    // Basic annotations:
                    chart.currentAnnotation.update({
                        shapes: [{
                            'stroke-width': strokeWidth,
                            stroke: strokeColor
                        }],
                        labels: [{
                            borderWidth: strokeWidth,
                            borderColor: strokeColor
                        }]
                    });
                }
                chart.stockToolbar.annotationsPopupContainer.style.display = 'none';
            }
        );
    }
    // split the data set into ohlc and volume
    const ohlc = [];
    const deliveryPercentage = [];
    const volume = [];
    let indexOfDate = csvdata[0].indexOf("Date  ");
    let indexOfopenPrice = csvdata[0].indexOf("Open Price  ");
    let indexOfHighPrice = csvdata[0].indexOf("High Price  ");
    let indexOfLowPrice = csvdata[0].indexOf("Low Price  ");
    let indexOfClosePrice = csvdata[0].indexOf("Close Price  ");
    let indexOfDeleviryPer = csvdata[0].indexOf("% Dly Qt to Traded Qty  ");
    let indexOfVolume = csvdata[0].indexOf("Total Traded Quantity  ");
    let indexOfStockName = csvdata[0].indexOf("Symbol  ");
    let stockName = csvdata[1][indexOfStockName];
    csvdata.shift();//remove first row of csv file
    for (let i = 0; i < csvdata.length; i++) {
        let date = new Date(csvdata[i][indexOfDate]).getTime()+(24*60*60*1000); // time in milliseconds
        ohlc.push([   //inserting data in ohlc array
            date, // the date
            Number(csvdata[i][indexOfopenPrice]), // open
            Number(csvdata[i][indexOfHighPrice]), // high
            Number(csvdata[i][indexOfLowPrice]), // low
            Number(csvdata[i][indexOfClosePrice]), // close
        ]);
        deliveryPercentage.push([   //inserting data in delivery percentage array
            date, // the date
            Number(csvdata[i][indexOfDeleviryPer]), // % Dly Qt to Traded Qty
        ]);
        volume.push([   //inserting data in volume array
            date, // the date
            Number(((csvdata[i][indexOfVolume]).replace(/\,/g,''))), // Total Traded Quantity
        ]);
    }
    Highcharts.stockChart('container', {
        chart: {
            rangeSelector: {
                enabled: false
            },
            events: {
                load: function () {
                    addPopupEvents(this);
                }
            }
        },
        yAxis: [{
            title: {
                text: 'Stock Price (In Rs)',
                style: {
                    color: 'black',
                    fontWeight: 'bold'
                }
            },
            labels: {
                align: 'left'
            },
            height: '60%',
            resize: {
                enabled: true
            }
        }, {
            title: {
                text: 'Dly %',
                style: {
                    color: 'black',
                    fontWeight: 'bold'
                }
            },
            labels: {
                align: 'left'
            },
            top: '60%',
            height: '20%',
            offset: 0
        }, {
            title: {
                text: 'Volume (In Lacs)',
                style: {
                    color: 'black',
                    fontWeight: 'bold'
                }
            },
            labels: {
                align: 'left'
            },
            top: '80%',
            height: '20%',
            offset: 0
        }],
        tooltip: {
            shape: 'square',
            headerShape: 'callout',
            borderWidth: 0,
            shadow: false,
            positioner: function (width, height, point) {
                const chart = this.chart;
                let position;

                if (point.isHeader) {
                    position = {
                        x: Math.max(
                            // Left side limit
                            chart.plotLeft,
                            Math.min(
                                point.plotX + chart.plotLeft - width / 2,
                                // Right side limit
                                chart.chartWidth - width - chart.marginRight
                            )
                        ),
                        y: point.plotY
                    };
                } else {
                    position = {
                        x: point.series.chart.plotLeft,
                        y: point.series.yAxis.top - chart.plotTop
                    };
                }

                return position;
            }
        },
        navigationBindings: {
            events: {
                selectButton: function (event) {
                    let newClassName = event.button.className + ' highcharts-active';
                    const topButton = event.button.parentNode.parentNode;

                    if (topButton.classList.contains('right')) {
                        newClassName += ' right';
                    }

                    // If this is a button with sub buttons,
                    // change main icon to the current one:
                    if (!topButton.classList.contains('highcharts-menu-wrapper')) {
                        topButton.className = newClassName;
                    }

                    // Store info about active button:
                    this.chart.activeButton = event.button;
                },
                deselectButton: function (event) {
                    event.button.parentNode.parentNode.classList.remove('highcharts-active');

                    // Remove info about active button:
                    this.chart.activeButton = null;
                },
                showPopup: function (event) {

                    if (!this.indicatorsPopupContainer) {
                        this.indicatorsPopupContainer = document
                            .getElementsByClassName('highcharts-popup-indicators')[0];
                    }

                    if (!this.annotationsPopupContainer) {
                        this.annotationsPopupContainer = document
                            .getElementsByClassName('highcharts-popup-annotations')[0];
                    }

                    if (event.formType === 'indicators') {
                        this.indicatorsPopupContainer.style.display = 'block';
                    } else if (event.formType === 'annotation-toolbar') {
                        // If user is still adding an annotation, don't show popup:
                        if (!this.chart.activeButton) {
                            this.chart.currentAnnotation = event.annotation;
                            this.annotationsPopupContainer.style.display = 'block';
                        }
                    }

                },
                closePopup: function () {
                    this.indicatorsPopupContainer.style.display = 'none';
                    this.annotationsPopupContainer.style.display = 'none';
                }
            }
        },
        stockTools: {
            gui: {
                enabled: false
            }
        },
        series: [{
            type: 'candlestick',
            id: 'aapl-ohlc',
            name: `${stockName} Stock Price`,
            data: ohlc
        }, {
            type: 'column',
            id: 'aapl-volume',
            name: `${stockName} Dly %`,
            data: deliveryPercentage,
            yAxis: 1
        }, {
            type: 'column',
            id: 'aapl-volume1',
            name: `${stockName} Volume`,
            data: volume,
            yAxis: 2
        }],
        responsive: {
            rules: [{
                condition: {
                    maxWidth: 800
                },
                chartOptions: {
                    rangeSelector: {
                        inputEnabled: false
                    }
                }
            }]
        }
    });
}