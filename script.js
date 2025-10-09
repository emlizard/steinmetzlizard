document.addEventListener('DOMContentLoaded', () => {
    // 코드를 체계적으로 관리하기 위한 App 객체
    const App = {
        elements: {
            modelSelect: document.getElementById('model'),
            paramGroups: document.querySelectorAll('.param-group'),
            computeBtn: document.getElementById('computeBtn'),
            resultDiv: document.getElementById('result'),
            graphDiv: document.getElementById('graph'),
            themeToggle: document.getElementById('theme-toggle'),
        },

        init() {
            this.initTheme();
            this.initEventListeners();
            this.updateParamVisibility(); // 초기 모델 파라미터 표시
            this.calculateAndDisplay();   // 페이지 로드 시 초기 계산 및 그래프
        },

        initTheme() {
            const sunIcon = `☀️`;
            const moonIcon = `🌙`;
            const setTheme = (theme) => {
                document.body.setAttribute('data-theme', theme);
                this.elements.themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon;
                localStorage.setItem('theme', theme);
                this.drawPlot(); // 테마 변경 시 그래프 다시 그리기
            };
            this.elements.themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.getAttribute('data-theme');
                setTheme(currentTheme === 'light' ? 'dark' : 'light');
            });
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
        },

        initEventListeners() {
            this.elements.modelSelect.addEventListener('change', this.updateParamVisibility.bind(this));
            this.elements.computeBtn.addEventListener('click', this.calculateAndDisplay.bind(this));
            // Add event listeners to all inputs to recalculate on change
            document.querySelectorAll('.input-field').forEach(input => {
                input.addEventListener('change', this.calculateAndDisplay.bind(this));
            });
        },
        
        updateParamVisibility() {
            const selectedModel = this.elements.modelSelect.value;
            this.elements.paramGroups.forEach(group => {
                group.style.display = group.id === `params-${selectedModel}` ? 'block' : 'none';
            });
            this.calculateAndDisplay(); // Update calculation when model changes
        },

        getValues() {
            const values = {};
            // 현재 활성화된 입력 필드와 공통 입력 필드의 모든 값을 가져옴
            document.querySelectorAll('input[type="number"], select').forEach(input => {
                if (input.offsetParent !== null || input.type === 'select-one') { // 화면에 보이는 요소 + select
                    if (input.type === 'number') {
                       values[input.id] = parseFloat(input.value);
                    }
                }
            });
            return values;
        },

        calculatePv(f_kHz, Bpk_mT, model, params) {
            const f = f_kHz * 1000;   // 주파수: kHz -> Hz
            const Bpk = Bpk_mT / 1000; // 자속밀도: mT -> T
            const T = 1 / f;

            try {
                switch (model) {
                    case 'CSE':
                        return params.k * Math.pow(f, params.alpha) * Math.pow(Bpk, params.beta);
                    case 'MSE':
                        return params.kh * Math.pow(f, params.alpha2) * Math.pow(Bpk, params.beta2) + params.ke * f * f * Bpk * Bpk;
                    case 'GSE': {
                        const ki = params.ki, alpha = params.alpha3, beta = params.beta3;
                        const n = 500; // Integration steps
                        const dt = T / n;
                        let integral = 0;
                        for (let i = 0; i < n; i++) {
                            const t = i * dt;
                            const dB_dt = 2 * Math.PI * f * Bpk * Math.cos(2 * Math.PI * f * t);
                            // Using peak-to-peak flux density (ΔB = 2 * Bpk) as per the standard GSE formula
                            const deltaB = 2 * Bpk;
                            integral += Math.pow(Math.abs(dB_dt), alpha) * Math.pow(deltaB, beta - alpha) * dt;
                        }
                        return ki * integral / T;
                    }
                    case 'iGSE': {
                        const kh = params.kh2, ke = params.ke2, alpha = params.alpha4, beta_h = params.beta4;
                        const n = 500; // Integration steps
                        const dt = T / n;
                        let integral = 0;
                        for(let i=0; i<n; i++){
                            const t = i * dt;
                            const B_t = Bpk * Math.sin(2 * Math.PI * f * t);
                            const dB_dt = 2 * Math.PI * f * Bpk * Math.cos(2 * Math.PI * f * t);
                            const hyst = kh * Math.pow(Math.abs(2 * B_t), beta_h - alpha); // Using 2*B(t) as proxy for minor loop ΔB
                            const eddy = ke * Math.pow(Math.abs(2 * B_t), 2 - alpha);
                            integral += (hyst + eddy) * Math.pow(Math.abs(dB_dt), alpha) * dt;
                        }
                        return integral / T;
                    }
                    default: return 0;
                }
            } catch (e) {
                console.error("Calculation Error:", e);
                return NaN;
            }
        },
        
        calculateAndDisplay() {
            const params = this.getValues();
            const model = this.elements.modelSelect.value;
            
            // 단일 포인트 계산
            const Pv_Wm3 = this.calculatePv(params.f, params.Bpk, model, params);
            const totalLoss_W = Pv_Wm3 * (params.volume * 1e-6); // cm³ -> m³
            
            if (!isNaN(totalLoss_W) && isFinite(totalLoss_W)) {
                this.elements.resultDiv.innerHTML = `
                    <strong>Result:</strong> 
                    Power Density (Pᵥ): <strong>${(Pv_Wm3 / 1000).toExponential(3)}</strong> kW/m³ | 
                    Total Loss (Pₗ): <strong>${totalLoss_W.toExponential(3)}</strong> W
                `;
            } else {
                 this.elements.resultDiv.innerHTML = `<strong style="color:var(--error);">Result:</strong> Invalid input or calculation error.`;
            }

            this.drawPlot(); // 계산 후 그래프 자동 업데이트
        },

        drawPlot() {
            const params = this.getValues();
            const model = this.elements.modelSelect.value;
            const isDarkMode = document.body.getAttribute('data-theme') === 'dark';

            // 그래프 범위를 합리적인 기본값으로 설정
            const f_range = Array.from({ length: 30 }, (_, i) => 10 + i * (500 - 10) / 29); // 10 to 500 kHz
            const B_range = Array.from({ length: 30 }, (_, i) => 10 + i * (300 - 10) / 29); // 10 to 300 mT
            
            const z_data = f_range.map(f => 
                B_range.map(B => {
                    const pv = this.calculatePv(f, B, model, params);
                    // 로그 스케일로 변환하여 가시성 향상
                    return pv > 0 ? Math.log10(pv) : null;
                })
            );

            const data = [{
                z: z_data, x: B_range, y: f_range, type: 'surface',
                colorscale: isDarkMode ? 'Cividis' : 'Viridis',
                colorbar: { title: 'log10(W/m³)', titleside: 'right' }
            }];

            const layout = {
                title: 'Core Loss Pᵥ vs. Frequency & Flux Density',
                scene: {
                    xaxis: { title: 'Bₚₖ (mT)' },
                    yaxis: { title: 'Frequency (kHz)' },
                    zaxis: { title: 'log10(Pᵥ W/m³)' }
                },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: 'var(--text-primary)' },
                margin: { l: 0, r: 0, b: 0, t: 40 }
            };

            Plotly.newPlot(this.elements.graphDiv, data, layout, {responsive: true});
        }
    };

    App.init();
});
