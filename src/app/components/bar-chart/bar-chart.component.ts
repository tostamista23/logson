import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-96">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: []
})
export class BarChartComponent implements AfterViewInit {
  @Input() data: { [key: number]: number } = {};
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  ngAfterViewInit() {
    this.updateChart();
  }

  ngOnChanges() {
    if (this.chartCanvas) {
      setTimeout(() => this.updateChart(), 0);
    }
  }

  private updateChart() {
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      return;
    }

    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values = Array.from({ length: 24 }, (_, i) => this.data[i] || 0);

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Entries per Hour',
            data: values,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        }
      }
    });
  }
}
