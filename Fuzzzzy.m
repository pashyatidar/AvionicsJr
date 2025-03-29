    % Create Fuzzy Inference System
    fis = mamfis("Name", "AC_Control");
    
    % Add Temperature Input (0 to 10)
    fis = addInput(fis, [0 10], "Name", "Temperature");
    fis = addMF(fis, "Temperature", "trapmf", [0 0 2 4], "Name", "Low");
    fis = addMF(fis, "Temperature", "gaussmf", [1.5, 5], "Name", "Medium");
    
    fis = addMF(fis, "Temperature", "trapmf", [6 8 10 10], "Name", "High");
    
    % Add Error Input (-5 to 5)
    fis = addInput(fis, [-5 5], "Name", "Error");
    fis = addMF(fis, "Error", "gaussmf", [1 -5], "Name", "Negative");
    fis = addMF(fis, "Error", "gaussmf", [1 0], "Name", "Zero");
    fis = addMF(fis, "Error", "gaussmf", [1 5], "Name", "Positive");
    
    % Add Cooling Power Output (0 to 30)
    fis = addOutput(fis, [0 30], "Name", "CoolingPower");
    fis = addMF(fis, "CoolingPower", "trapmf", [0 0 5 10], "Name", "Low");
    fis = addMF(fis, "CoolingPower", "trapmf", [5 10 15 20], "Name", "Medium");
    fis = addMF(fis, "CoolingPower", "trapmf", [15 20 30 30], "Name", "High");
    
    % Define Rules (Including Error)
    rulesList = [
        "Temperature==Low & Error==Negative => CoolingPower=Medium"
        "Temperature==Low & Error==Zero => CoolingPower=Low"
        "Temperature==Low & Error==Positive => CoolingPower=Low"
        
        "Temperature==Medium & Error==Negative => CoolingPower=High"
        "Temperature==Medium & Error==Zero => CoolingPower=Medium"
        "Temperature==Medium & Error==Positive => CoolingPower=Low"
        
        "Temperature==High & Error==Negative => CoolingPower=High"
        "Temperature==High & Error==Zero => CoolingPower=High"
        "Temperature==High & Error==Positive => CoolingPower=Medium"
    ];
    
    % Add Rules to FIS
    fis = addRule(fis, rulesList);
    
    % Plot Membership Functions
    figure;
    subplot(3,1,1);
    plotmf(fis, "input", 1);
    title("Temperature Membership Functions");
    
    subplot(3,1,2);
    plotmf(fis, "input", 2);
    title("Error Membership Functions");
    
    subplot(3,1,3);
    plotmf(fis, "output", 1);
    title("Cooling Power Membership Functions");
    
    % Generate 3D Surface Plot
    [temp_grid, error_grid] = meshgrid(0:1:10, -5:1:5);
    cooling_power = zeros(size(temp_grid));
    
    for i = 1:size(temp_grid,1)
        for j = 1:size(temp_grid,2)
            cooling_power(i,j) = evalfis(fis, [temp_grid(i,j), error_grid(i,j)]);
        end
    end
    
    figure;
    surf(temp_grid, error_grid, cooling_power);
    xlabel("Temperature (°C)");
    ylabel("Error (°C)");
    zlabel("Cooling Power (%)");A
    title("3D Fuzzy Surface for Cooling Power");
    colorbar;
