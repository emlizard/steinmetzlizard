    function getValue(id){ return parseFloat(document.getElementById(id).value); }
    document.addEventListener('DOMContentLoaded', ()=>{
      const modelEl = document.getElementById('model');
      const sections = {CSE:'params-CSE', MSE:'params-MSE', GSE:'params-GSE', iGSE:'params-iGSE'};
      function toggleSections(){
        Object.keys(sections).forEach(key=>{
          document.getElementById(sections[key])
            .classList.toggle('hidden', key !== modelEl.value);
        });
      }
      modelEl.addEventListener('change', toggleSections);
      toggleSections();

      document.getElementById('computeBtn').addEventListener('click', compute);
      document.getElementById('plotBtn').addEventListener('click', plotGraph);
    });

    function compute(){
      const f   = getValue('f');
      const Bpk = getValue('Bpk');
      const Vcc = getValue('volume');
      const T   = 1 / f;
      let Pv = 0;
      const model = document.getElementById('model').value;

      if(model === 'CSE'){
        const k = getValue('k'), α = getValue('alpha'), β = getValue('beta');
        Pv = k * Math.pow(f, α) * Math.pow(Bpk, β);
      } else if(model === 'MSE'){
        const kh = getValue('kh'), ke = getValue('ke'), α = getValue('alpha2'), β = getValue('beta2');
        Pv = kh * Math.pow(f, α) * Math.pow(Bpk, β) + ke * f * Math.pow(Bpk, 2);
      } else if(model === 'GSE'){
        const ki = getValue('ki'), α = getValue('alpha3'), β = getValue('beta3'), n = getValue('steps');
        let sum = 0, dt = T / n/1000;
        for(let i=0; i<n; i++){
          const t = i * dt;
          const Bt = Bpk * Math.sin(2 * Math.PI * f *1000 * t)/1000;
          const dB = 2 * Math.PI * f * Bpk * Math.cos(2 * Math.PI * f *1000* t);
          sum += Math.pow(Math.abs(dB), α) * Math.pow(Math.abs(Bt), β) * dt;
        }
        Pv = ki / T * sum*1000000;
      } else {
        const kh2 = getValue('kh2'), ke2 = getValue('ke2'), α = getValue('alpha4'), βh = getValue('beta4'), n = getValue('steps2');
        let sum = 0, dt = T / n/1000;
        for(let i=0; i<n; i++){
          const t = i * dt;
          const Bt = Bpk * Math.sin(2 * Math.PI * f *1000 * t)/1000;
          const dB = 2 * Math.PI * f * Bpk * Math.cos(2 * Math.PI * f *1000 * t);
          const hyst = kh2 * Math.pow(Math.abs(dB), α) * Math.pow(Math.abs(Bt), βh);
          const eddy = ke2 * Math.pow(Math.abs(dB), 1) * Math.pow(Math.abs(Bt), 2);
          sum += (hyst + eddy) * dt;
        }
        Pv = sum / T*1000000;
      }

      const Pcv = Pv;          // mW/cc
      const P   = Pv * Vcc;    // mW
      document.getElementById('result').innerText =
        `Pcv = ${Pcv.toFixed(3)} mW/cc,   P = ${P.toFixed(3)} mW`;
    }

    function linspace(min, max, n){
      const arr = [], step = (max - min) / (n - 1 || 1);
      for(let i = 0; i < n; i++) arr.push(min + step * i);
      return arr;
    }

    function plotGraph(){
      const fArr = linspace(getValue('fMin'), getValue('fMax'), getValue('fSteps'));
      const BArr = linspace(getValue('BMin'), getValue('BMax'), getValue('BSteps'));
      const k    = getValue('k'), α = getValue('alpha'), β = getValue('beta');

      const Z = BArr.map(BmT => 
        fArr.map(fkHz => k * Math.pow(fkHz, α) * Math.pow(BmT, β))
      );

      Plotly.newPlot('graph', [{
        type: 'heatmap',
        x: fArr,
        y: BArr,
        z: Z,
        colorscale: 'Rainbow',
        colorbar: { title: 'P_v (mW)', tickformat: ',.0f' }
      }], {
        xaxis: { title: 'f (kHz)', tickformat: ',.0f' },
        yaxis: { title: 'B (mT)',   tickformat: ',.0f' }
      });
    }
