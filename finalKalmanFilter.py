import numpy as np
import pandas as pd
df = pd.read_csv(r'C:\Users\ADMIN\Downloads\lollslls.csv')
df = df.iloc[245:].reset_index(drop=True)
net_a = df['acc_tot'].to_numpy()
acc = np.array(net_a)
v = df ['velocity'].to_numpy()
velocity = np.array(v)
al = df['altitude'].to_numpy()
altitufe = np.array(al)
pressure = df['pressure'].to_numpy()
t = df['time'].to_numpy()
time = np.array(t)  
net_a_points = np.array(net_a)



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
    def step(self, z,R=None,A=None,B=None,u=None):
        if R is not None :
            self.R = R
        if A is not None :
            self.A = A    
        if B is not None :
            self.B = B 
        if u is not None :
            self.u = u 
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

    
# Kalman Filter matrices
A = np.eye(2)
B = np.zeros((2, 1))
u = np.array([[0]])
H = np.eye(2)
Q = np.array([[0.0001, 0],
              [0, 0.0001]])
x0 = np.array([[acc[0]], [velocity[0]]])
P0 = np.eye(2)


# Initialize Kalman filter with dummy R (it'll be updated dynamically)
kf = KalmanFilter(A, B, u, Q, H, R=np.eye(2), x_pred=x0, P_pred=P0)
filtered_acc = []

# Apply Kalman filter with dynamic R based on local variance
for i in range (len(acc)):
    if i>=2:
        z = np.array ([[acc[i]], [time[i]]])
        deltaT = t[i] - t[i-1]
        A_dynamic = np.array([[1,deltaT],[0,1]])
        b = (0.5*deltaT*deltaT)
        B_dynamic = np.array([[b], [deltaT]])

        
        u_Dynamic  = acc[i] - acc[i-1]
        
        p_window = np.array([acc[i], acc[i-1], acc[i-2]])
        t_window = np.array([velocity[i], velocity[i-1], velocity[i-2]])
        Step1 = np.mean(p_window)
        Step0 = np.mean(t_window) 
        R11 = np.mean((p_window - Step1) ** 2)
        R22 = np.mean((t_window - Step0) ** 2)
        R12 = np.mean((p_window - Step1) * (t_window - Step0))
        R_dynamic = np.array([[R11, R12],
                      [R12, R22]])  
        #   def step(self, z,R=None,A=None,B=None,u=None):
        step_result = kf.step(z, R=R_dynamic,A=A_dynamic,B=B_dynamic,u=u_Dynamic)
        filtered_acc.append(kf.x[0, 0])  # append pressure estimate
        
    else:
        filtered_acc.append(pressure[i])
        
        




apogee_times = []
apogee_pressures = []
last_apogee_time = -np.inf
min_apogee_gap = 2  
slope_threshold = 0.05  

global_min_pressure = float('inf')
for i in range(3, len(filtered_acc) - 3):
    
    
    prev_slope = (filtered_acc[i] - filtered_acc[i - 3]) / (t[i] - t[i - 3])
    next_slope = (filtered_acc[i + 3] - filtered_acc[i]) / (t[i + 3] - t[i])
    
    local_window = filtered_acc[i - 1:i + 2]
    is_strict_local_min = filtered_acc[i] == np.min(local_window)
    
    is_flattish = abs(prev_slope) < slope_threshold and abs(next_slope) < slope_threshold
    is_new_global_min = filtered_acc[i] < global_min_pressure

    if is_strict_local_min and is_flattish and is_new_global_min:
        if (t[i] - last_apogee_time) >= min_apogee_gap:
            print(f"Apogee detected at time {t[i]:.2f}s with pressure {filtered_acc[i]:.2f}")
            apogee_times.append(t[i])
            apogee_pressures.append(filtered_acc[i])
            last_apogee_time = t[i]
            global_min_pressure = filtered_acc[i]

        
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 5))
if apogee_times:  
   plt.axvline(x=apogee_times[0], color='green', linestyle='--', linewidth=2, label=f'First Apogee @ {apogee_times[0]:.2f}s')

#plt.axvline(x=11.58, color='purple', linestyle='--', linewidth=2, label='Target Time 11.58s')
plt.plot(t, acc, label='Raw Acceleration', alpha=0.5)
plt.plot(t, filtered_acc, label='Filtered Acceleration', linewidth=2)
plt.scatter(apogee_times, apogee_pressures, color='red', label='Apogee Detected', zorder=5)
plt.xlabel('Time')
plt.ylabel('Pressure')
plt.legend()
plt.title('Kalman Filtered Pressure with Apogee Detection')
plt.grid()
plt.show()