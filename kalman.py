import numpy as np
import pandas as pd
df = pd.read_csv(r'C:\Users\ADMIN\Downloads\lollslls.csv')
df = df.iloc[245:].reset_index(drop=True)
net_a = df['acc_tot'].to_numpy()
pressure = df['pressure'].to_numpy()
t = df['time'].to_numpy()
time = np.array(t)
net_a_points = np.array(net_a)
velocity = np.array (0)


class KalmanFilter: 
    def __init__(self, A, B, u, Q, H, R, x_pred, P_pred ):
        self.A = A                    # State transition matrix
        self.B = B                    # Control input matrix
        self.u = u                    # Control vector
        self.Q = Q                    # Process noise covariance
        self.H = H                    # Observation matrix
        self.R = R                    # Measurement noise covariance
        
        #self.P_pred = P0

        self.x_pred = x_pred          # Predicted state estimate
        self.P_pred = P_pred          # Predicted covariance estimate
        self.z = None
        self.y = None
        self.s = None
        self.k = None
        self.x = None
        self.P = None

        
    def StateTransitionModel(self):
        self.x_pred = np.dot(self.A, self.x_pred) + np.dot(self.B, self.u)
        return self.x_pred
    
    def MeasurementModel (self,z):
        self.z =z 
        z_pred = np.dot(self.H,self.x_pred)  +   self.R
        return z_pred
    
    def pred_state_estimate (self):
        self.P_pred = np.dot(self.A, np.dot(self.P_pred, self.A.T)) + self.Q
        return self.P_pred
    
    def Innovate (self):
        self.y = self.z - np.dot(self.H,self.x_pred)
        return self.y
    
    def InnovateCovariance (self):
        self.s = np.dot(self.H, np.dot(self.P_pred, self.H.T)) + self.R
        return self.s
    
    def KalmanGain (self):
        self.k = self.P_pred @ self.H.T @ np.linalg.inv(self.s)    
        return self.k
    
    def updateEstimate (self):
        self.x = self.x_pred + np.dot(self.k, self.y)
        self.x_pred = self.x  # for continuity
        return self.x
    
    def  updateEstimateCovariance (self):
        I = np.eye(self.P_pred.shape[0])
        self.P = np.dot(I - np.dot(self.k, self.H), self.P_pred)
        return self.P
    def step(self, z):
        x_prior = self.x_pred.copy()
        P_prior = self.P_pred.copy()
        
        self.MeasurementModel(z)
        self.pred_state_estimate()
        self.Innovate()
        self.InnovateCovariance()
        self.KalmanGain()
        self.updateEstimate()
        self.updateEstimateCovariance()
        return {"x_prior": x_prior,
        "P_prior": P_prior,
        "x_post": self.x,
        "P_post": self.P}

A = np.array([[1]])         
B = np.array([[0]])          
u = np.array([[0]])         
H = np.array([[1]])          
Q = np.array([[0.0001]])   
R = np.array([[0.1]])       
x0 = np.array([[pressure[0]]])  
P0 = np.array([[1]])         

kf = KalmanFilter(A=A, B=B, u=u, Q=Q, H=H, R=R, x_pred=x0, P_pred=P0)
filtered_pressure = []

for z in pressure:
    step_result = kf.step(np.array([[z]]))  
    filtered_pressure.append(kf.x[0, 0]) 

filtered_pressure = np.array(filtered_pressure)

apogee_times = []
apogee_pressures = []
last_apogee_time = -np.inf
min_apogee_gap = 2  
slope_threshold = 0.05  

global_min_pressure = float('inf')

for i in range(3, len(filtered_pressure) - 3):
    prev_slope = (filtered_pressure[i] - filtered_pressure[i - 3]) / (t[i] - t[i - 3])
    next_slope = (filtered_pressure[i + 3] - filtered_pressure[i]) / (t[i + 3] - t[i])
    
    local_window = filtered_pressure[i - 1:i + 2]
    is_strict_local_min = filtered_pressure[i] == np.min(local_window)
    
    is_flattish = abs(prev_slope) < slope_threshold and abs(next_slope) < slope_threshold
    is_new_global_min = filtered_pressure[i] < global_min_pressure

    if is_strict_local_min and is_flattish and is_new_global_min:
        if (t[i] - last_apogee_time) >= min_apogee_gap:
            print(f"Apogee detected at time {t[i]:.2f}s with pressure {filtered_pressure[i]:.2f}")
            apogee_times.append(t[i])
            apogee_pressures.append(filtered_pressure[i])
            last_apogee_time = t[i]
            global_min_pressure = filtered_pressure[i]

        
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 5))
if apogee_times:  
   plt.axvline(x=apogee_times[0], color='green', linestyle='--', linewidth=2, label=f'First Apogee @ {apogee_times[0]:.2f}s')

#plt.axvline(x=11.58, color='purple', linestyle='--', linewidth=2, label='Target Time 11.58s')
plt.plot(t, pressure, label='Raw Pressure', alpha=0.5)
plt.plot(t, filtered_pressure, label='Filtered Pressure', linewidth=2)
plt.scatter(apogee_times, apogee_pressures, color='red', label='Apogee Detected', zorder=5)
plt.xlabel('Time')
plt.ylabel('Pressure')
plt.legend()
plt.title('Kalman Filtered Pressure with Apogee Detection')
plt.grid()
plt.show()