import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartData } from '../../services/chart-stats.service';

// register everything Chart.js exposes so scales and helpers are available
// without this you'll see errors like "linear is not a registered scale"
Chart.register(...registerables);

export type ChartType = 'bar' | 'pie' | 'doughnut' | 'line';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg relative">
      <!-- Loading overlay -->
      <div *ngIf="isLoading" class="absolute inset-0 bg-gray-900/60 rounded-lg flex items-center justify-center z-10">
        <div class="text-center">
          <div class="inline-block">
            <div class="w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p class="text-gray-400 text-sm mt-3">Loading chart...</p>
        </div>
      </div>
      <div *ngIf="!chartInitialized && (!data || !data.labels || data.labels.length === 0)" 
           class="text-gray-400 text-center p-4 absolute">
        <p>No data available</p>
      </div>
      <canvas 
        #chartCanvas 
        width="800"
        height="400"
        style="max-width: 100%; max-height: 100%; width: 100%; height: 100%;"></canvas>
    </div>
  `, 
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: transparent;
    }
    
    div {
      background: transparent;
    }
    
    canvas {
      background: transparent;
    }
  `]
})
export class ChartComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data!: ChartData;
  @Input() chartType: ChartType = 'bar';
  @Input() title: string = '';
  @Input() hideLegend: boolean = false;
  @Input() isLoading: boolean = false;
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  chartInitialized = false;

  ngOnInit() {
    // Wait for view to be ready then create chart
    setTimeout(() => this.createChart(), 100);
  }

  ngOnChanges(changes: SimpleChanges) {

    // if the chart type changes we need a fresh instance
    if (changes['chartType'] && !changes['chartType'].firstChange) {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
        this.chartInitialized = false;
      }
      setTimeout(() => this.createChart(), 0);
      return;
    }

    if (!this.chart) {
      setTimeout(() => this.createChart(), 0);
    } else if (changes['data']) {
      this.updateChart();
    }
  }

  private createChart() {

    // make sure we don't try to reuse a canvas that's already owned by
    // another Chart instance.
    if (this.chart) {
      try {
        this.chart.destroy();
      } catch (e) {
      }
      this.chart = null;
      this.chartInitialized = false;
    }

    if (!this.canvasRef) {
      const canvas = document.querySelector('app-chart canvas') as HTMLCanvasElement;
      if (canvas) {
        this.initializeChart(canvas);
      } else {
      }
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    this.initializeChart(canvas);
  }

  private initializeChart(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    try {
      const config: ChartConfiguration = {
        type: this.chartType,
        data: this.data as any,
        options: this.getChartOptions() as any
      };

      this.chart = new Chart(ctx, config);
      this.chartInitialized = true;
    } catch (error) {
    }
  }

  private updateChart() {
    if (!this.chart || !this.data) return;

    this.chart.data = this.data as any;
    this.chart.options = this.getChartOptions() as any;
    this.chart.update();
  }

  private getChartOptions(): any {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: !this.hideLegend,
          labels: {
            color: '#d1d5db',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f3f4f6',
          bodyColor: '#e5e7eb',
          borderColor: '#4b5563',
          borderWidth: 1
        }
      }
    };

    if (this.chartType === 'pie' || this.chartType === 'doughnut') {
      return {
        ...baseOptions
        // no additional plugins here; datalabels is not registered by default
      };
    } else if (this.chartType === 'line') {
      return {
        ...baseOptions,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(107, 114, 128, 0.2)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(107, 114, 128, 0.2)' },
            ticks: { color: '#9ca3af' }
          }
        }
      };
    } else {
      return {
        ...baseOptions,
        indexAxis: this.chartType === 'bar' ? 'x' : 'y',
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(107, 114, 128, 0.2)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(107, 114, 128, 0.2)' },
            ticks: { color: '#9ca3af' }
          }
        }
      };
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      try {
        this.chart.destroy();
      } catch (e) {
      }
      this.chart = null;
    }
  }
}
