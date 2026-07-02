import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import TimeoutException

BASE_URL = "http://localhost:5173"
DELAY = 2.0  # Ralentizar la visualización para poder seguir la prueba

def inicializarDriver(browser_name):
    if browser_name.lower() == "chrome":
        driver = webdriver.Chrome()
    elif browser_name.lower() == "edge":
        driver = webdriver.Edge()
    elif browser_name.lower() == "firefox":
        driver = webdriver.Firefox()
    else:
        raise ValueError(f"Navegador no soportado: {browser_name}")
    return driver

def test_registro_y_login(driver, rol_name, target_path):
    wait = WebDriverWait(driver, 15)
    
    # Generar credenciales únicas para esta ejecución
    unique_id = f"{int(time.time())}_{random.randint(10, 99)}"
    email = f"user_{rol_name}_{unique_id}@test.com"
    password = "Password123!"

    print(f"\n--- Probando Rol: {rol_name.upper()} ---")

    # ==========================================
    # 1. PASO: REGISTRO
    # ==========================================
    print(f"  [1] Registrando usuario: {email}...")
    driver.get(f"{BASE_URL}/register")
    time.sleep(DELAY)

    # Seleccionar la pestaña del rol
    if rol_name == "padre":
        tab_xpath = "//button[contains(text(), 'Padre / Tutor')]"
    elif rol_name == "paciente":
        tab_xpath = "//button[contains(text(), 'Hijo (TEA)')]"
    elif rol_name == "terapeuta":
        tab_xpath = "//button[contains(text(), 'Terapeuta')]"
    
    wait.until(EC.element_to_be_clickable((By.XPATH, tab_xpath))).click()
    time.sleep(DELAY)

    # Rellenar credenciales
    wait.until(EC.presence_of_element_located((By.ID, "reg-email"))).send_keys(email)
    driver.find_element(By.ID, "reg-pass").send_keys(password)
    driver.find_element(By.ID, "reg-confirm").send_keys(password)
    time.sleep(DELAY)

    # Rellenar campos adicionales de rol
    if rol_name == "padre":
        driver.find_element(By.ID, "padre-tel").send_keys("5512345678")
        driver.find_element(By.ID, "padre-dir").send_keys("Ciudad de Mexico")
    elif rol_name == "paciente":
        Select(driver.find_element(By.ID, "paciente-etapa")).select_by_value("6-12")
        Select(driver.find_element(By.ID, "paciente-com")).select_by_value("Básico")
    elif rol_name == "terapeuta":
        driver.find_element(By.ID, "ter-esp").send_keys("Psicologia Infantil")
        driver.find_element(By.ID, "ter-ced").send_keys("CED123456")
    time.sleep(DELAY)

    # Enviar formulario
    driver.find_element(By.XPATH, "//button[@type='submit']").click()

    # Aceptar alerta de éxito
    print("  [2] Esperando alerta de registro exitoso...")
    wait.until(EC.alert_is_present())
    alert = driver.switch_to.alert
    print(f"  [Alerta recibida]: '{alert.text}'")
    alert.accept()
    time.sleep(DELAY)

    # ==========================================
    # 2. PASO: INICIO DE SESIÓN
    # ==========================================
    # El usuario quiere iniciar sesion estrictamente con la cuenta creada en el paso 1
    print(f"  [3] Iniciando sesion con la cuenta recien registrada: {email}...")
    driver.get(f"{BASE_URL}/login")
    time.sleep(DELAY)

    # Introducir credenciales
    email_input = wait.until(EC.presence_of_element_located((By.ID, "email-input")))
    email_input.clear()
    email_input.send_keys(email)
    
    pass_input = driver.find_element(By.ID, "password-input")
    pass_input.clear()
    pass_input.send_keys(password)
    time.sleep(DELAY)

    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    print("  [4] Esperando redireccion al Dashboard...")

    try:
        # Esperar redirección al dashboard
        wait.until(EC.url_contains(target_path))
        time.sleep(DELAY)

        if not driver.current_url.endswith(target_path):
            raise Exception(f"Error de redireccion. URL actual: {driver.current_url}")
            
        print(f"  [+] Exito: Inicio de sesion correcto y redireccion a {target_path}")

    except TimeoutException as te:
        # Capturar e imprimir error visible en pantalla
        try:
            error_elements = driver.find_elements(By.XPATH, "//div[contains(., 'incorrectos') or contains(., 'confirm') or contains(., 'error') or contains(@style, 'fef2f2')]")
            for err_el in error_elements:
                if err_el.text.strip():
                    print(f"    [!] Error en pantalla: '{err_el.text.strip()}'")
                    break
        except Exception:
            pass

        # Capturar e imprimir logs de la consola del navegador para diagnóstico
        try:
            print("    [!] Logs de la consola del navegador:")
            browser_logs = driver.get_log('browser')
            for log in browser_logs:
                print(f"        {log['level']}: {log['message']}")
        except Exception:
            pass

        raise te

    # Cerrar sesión
    driver.get(f"{BASE_URL}/")
    driver.execute_script("localStorage.clear(); sessionStorage.clear();")
    time.sleep(DELAY)

def main():
    navegadores = ["chrome", "edge", "firefox"]

    for nav in navegadores:
        print(f"\n=============================================")
        print(f" INICIANDO PRUEBAS EN NAVEGADOR: {nav.upper()}")
        print(f"=============================================")
        driver = None
        try:
            driver = inicializarDriver(nav)
            driver.maximize_window()
            
            # Prueba Padre
            test_registro_y_login(driver, "padre", "/padre")
            
            # Prueba Paciente
            test_registro_y_login(driver, "paciente", "/paciente")
            
            # Prueba Terapeuta
            test_registro_y_login(driver, "terapeuta", "/terapeuta")
            
            print(f"\n[OK] Todas las pruebas en {nav.upper()} finalizaron con exito.")
        except Exception as e:
            print(f"[ERROR] Fallo en {nav.upper()}: {e}")
        finally:
            if driver:
                driver.quit()

if __name__ == '__main__':
    main()
