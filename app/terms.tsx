import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Terms() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#3dbac6" />
        </TouchableOpacity>
        <Text style={styles.title}>Términos y Condiciones</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Index */}
        <View style={styles.termsIndexSection}>
          <Text style={styles.termsSectionTitle}>ÍNDICE</Text>
          <View style={styles.termsIndexList}>
            <Text style={styles.termsIndexItem}>I. OBJETO. ............................................................................................................................. 1</Text>
            <Text style={styles.termsIndexItem}>II. USUARIO. ......................................................................................................................... 2</Text>
            <Text style={styles.termsIndexItem}>III. ACCESO AL SITIO Y/O APP Y LICENCIA. ................................................................. 3</Text>
            <Text style={styles.termsIndexItem}>IV. SU CUENTA. ................................................................................................................... 3</Text>
            <Text style={styles.termsIndexItem}>V. CUENTAS INACTIVAS. ................................................................................................... 4</Text>
            <Text style={styles.termsIndexItem}>VI. PROPIEDAD INTELECTUAL. ...................................................................................... 5</Text>
            <Text style={styles.termsIndexItem}>VII. LIBERACIÓN DE GARANTÍAS Y LÍMITE DE RESPONSABILIDAD. ................... 5</Text>
            <Text style={styles.termsIndexItem}>VIII. COMENTARIOS DEL USUARIO. .............................................................................. 6</Text>
            <Text style={styles.termsIndexItem}>IX. COMUNICACIONES. ..................................................................................................... 7</Text>
            <Text style={styles.termsIndexItem}>X. MODIFICACIONES Y DIVISIBILIDAD. ....................................................................... 7</Text>
            <Text style={styles.termsIndexItem}>XI. COOKIES. ........................................................................................................................ 7</Text>
            <Text style={styles.termsIndexItem}>XII. CONTROVERSIAS. ....................................................................................................... 8</Text>
            <Text style={styles.termsIndexItem}>XIII. ABONOS. ...................................................................................................................... 8</Text>
            <Text style={styles.termsIndexItem}>XIV. COMISIÓN POR SALIDA. .......................................................................................... 9</Text>
          </View>
        </View>

        {/* Introduction */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsContentText}>
            Bienvenido a CENT, example.com el cual permite a "DEMO APP", S.A.P.I. de C.V., ("CENT" o el "Titular"), quien tiene su domicilio establecido en Calle Ejemplo 123, poner a su disposición los servicios ofrecidos por la misma, dentro de nuestro Sitio y/o App, como en nuestras aplicaciones móviles. Al navegar por el Sitio y/o App y concretar operaciones en el mismo, usted declara ser mayor de edad en los términos del artículo 646 del Código Civil Federal, con plena capacidad para disponer de su persona y de sus bienes. Asimismo, usted acepta haber leído y aceptado plenamente los presentes Términos y Condiciones y comprendido el alcance legal de la operación que realiza.
          </Text>
        </View>

        {/* Section I */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsSectionTitle}>I. OBJETO.</Text>
          <Text style={styles.termsContentText}>
            El objeto de los Términos y Condiciones es regular el acceso y la utilización, por parte del usuario (el "Usuario") del Sitio y/o App, entendiendo por éste cualquier tipo de contenido, producto y/o servicio que se encuentre a disposición del público en general dentro de nuestro Sitio y/o App como de nuestras aplicaciones móviles.
          </Text>
          <Text style={styles.termsContentText}>
            El Titular se reserva la facultad de modificar en cualquier momento y sin previo aviso, la presentación, contenido, funcionalidad, productos, servicios, promociones, beneficios y la configuración que pudiera estar contenida en el Sitio y/o App.
          </Text>
          <Text style={styles.termsContentText}>
            En este sentido, el Usuario reconoce y acepta que el Titular, en cualquier momento podrá interrumpir, desactivar o cancelar cualquiera de los elementos que conforman el Sitio y/o App, así como el acceso a los mismos.
          </Text>
          <Text style={styles.termsContentText}>
            Toda vez que el Sitio y/o App funcionan a través de internet y que el Titular no es un proveedor de servicios de internet, será responsabilidad única y exclusiva del Usuario llevar a cabo todos los actos previos que le permitan utilizar el Sitio y/o App, como lo pueden ser la contratación de servicios de telecomunicaciones y la conexión a redes públicas o privadas. Además, correrán a cargo del Usuario los costos inherentes a aquellos contenidos, productos y/o servicios ofrecidos en el Sitio y/o App que así lo requieran. El Sitio y/o App precisará los contenidos, productos y/o servicios que, de contratarse por parte del Usuario, le generarán algún costo.
          </Text>
          <Text style={styles.termsContentText}>
            El acceso a parte de los contenidos y servicios del Sitio y/o App podrá realizarse previa suscripción o registro del Usuario.
          </Text>
          <Text style={styles.termsContentText}>
            El Sitio y/o App puede ser contratado únicamente por personas que cuenten con la mayoría de edad (mayores de 18 años). En caso de que la App y/o el Sitio y/o App Web sean utilizado(s) por un menor de edad, se entenderá que éste cuenta con la autorización expresa del padre o tutor facultado para ello, quedando el Titular deslindado de todos los actos llevados a cabo por parte de menores de edad que pudieran causar daños y/o perjuicios a sus padres, tutores y/o los titulares de los medios de pago utilizados para adquirir contenidos, productos y/o servicios en el Sitio y/o App.
          </Text>
          <Text style={styles.termsContentText}>
            Los padres, tutores y/o titulares de los medios de pago utilizados por menores de edad dentro del Sitio y/o App, serán responsables frente al Titular de las obligaciones económicas adquiridas por dicho(s) menor(es) de edad.
          </Text>
          <Text style={styles.termsContentText}>
            El Sitio y/o App está dirigido principalmente a todo Usuario residente en la República Mexicana, por lo cual, el Titular no asegura que el Sitio y/o App funcione total o parcialmente en otros países y/o cumplan total o parcialmente con la legislación de éstos, de forma que, si el Usuario reside o tiene domicilio establecido en otro país y decide acceder o utilizar el Sitio y/o App, lo hará bajo su propia responsabilidad y deberá asegurarse de que tal acceso y navegación cumple con la legislación local que le es aplicable, quedando el Titular deslindado de toda responsabilidad que pueda derivar de la utilización del Sitio y/o App que se realice fuera del territorio mexicano, o bien, de las fallas en el funcionamiento del servicio por cuestiones de geolocalización, o cualquiera otra completamente inherentes al Usuario.
          </Text>
          <Text style={styles.termsContentText}>
            El Usuario deberá sacar en paz y a salvo al Titular de cualquier procedimiento, disputa o litigio iniciado en el extranjero en contra del Titular y que derive del uso del Sitio y/o App por parte del Usuario fuera del territorio mexicano.
          </Text>
          <Text style={styles.termsContentText}>
            El Usuario será responsable del uso o gestión de la cuenta que utilice en el Sitio y/o App por parte de terceros, siendo el Usuario el responsable frente al Titular de cualquier acto que se lleve a cabo a través de la referida cuenta.
          </Text>
        </View>

        {/* Section II */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsSectionTitle}>II. USUARIO.</Text>
          <Text style={styles.termsContentText}>
            Antes de hacer completo uso del Sitio y/o App Web y de sus beneficios, el Usuario deberá de proporcionar toda la información y datos solicitados al igual que tendrá la obligación de firmar y aceptar cualquier documentación externa que le sea proporcionada, mismo que se encuentra en el Sitio y/o App Web
          </Text>
          <Text style={styles.termsContentText}>
            El acceso o uso de del Sitio y/o App Web, confiere la condición de Usuario, por lo que quedará sujeto a los presentes Términos y Condiciones, así como a sus ulteriores modificaciones, sin perjuicio de la aplicación, por tanto, se tendrán por aceptados desde el momento en el que se accede al Sitio y/o App. Dada la relevancia de lo anterior, el Usuario debe revisar y aceptar las actualizaciones que se realicen a los Términos y Condiciones, para poder utilizar el Sitio y/o App. El uso del Sitio y/o App implica el consentimiento de los Términos y Condiciones por parte del Usuario, aun cuando dicho uso se lleve a cabo por parte de terceras personas.
          </Text>
          <Text style={styles.termsContentText}>
            Es responsabilidad del Usuario utilizar el Sitio y/o App de acuerdo a la forma en la que fueron diseñados. En este sentido, queda prohibida la utilización de cualquier tipo de software que automatice la interacción o descarga de los contenidos o servicios proporcionados a través del Sitio y/o App. Además, el Usuario se compromete a utilizar la información, contenidos o servicios ofrecidos a través del Sitio y/o App de manera lícita, sin contravenir lo dispuesto en los Términos y Condiciones, disposiciones jurídicas, la moral o el orden público, y se abstendrá de realizar cualquier acto que pueda suponer una afectación a los derechos de terceros, o perjudique de algún modo el funcionamiento del Sitio y/o App.
          </Text>
          <Text style={styles.termsContentText}>
            Asimismo, el Usuario se compromete a proporcionar información lícita y veraz en los formularios habilitados en el Sitio y/o App, en los cuales el Usuario tenga que proporcionar ciertos datos o información para el acceso a algún contenido, producto o servicio ofrecido por el propio Sitio y/o App. En todo caso, el Usuario notificará de forma inmediata al Titular acerca de cualquier hecho que permita suponer el uso indebido de la información registrada en dichos formularios, tales como, robo, extravío, o acceso no autorizado a cuentas y/o contraseñas, con el fin de proceder a su inmediata cancelación.
          </Text>
          <Text style={styles.termsContentText}>
            El sólo acceso al Sitio y/o App no supone el establecimiento de ningún tipo de relación entre el Titular y el Usuario.
          </Text>
          <Text style={styles.termsContentText}>
            Al tratarse de un Sitio y/o App dirigida exclusivamente a personas que cuenten con la mayoría de edad, el Usuario manifiesta ser mayor de edad y disponer de la capacidad jurídica necesaria para sujetarse a los Términos y Condiciones.
          </Text>
          <Text style={styles.termsContentText}>
            El Usuario autoriza al Titular para cancelar su cuenta, de manera unilateral y sin necesidad de llevar a cabo una notificación previa,
          </Text>
        </View>

        {/* Section III */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsSectionTitle}>III. ACCESO AL SITIO Y/O APP Y LICENCIA.</Text>
          <Text style={styles.termsContentText}>
            Sujeto al cumplimiento por parte de usted de estos Términos y Condiciones aplicables, CENT le conceden una licencia limitada no exclusiva, no transferible y no sub-licenciable, de acceso y utilización al Sitio y/o App para fines personales no comerciales. Esta licencia no incluye derecho alguno de reventa ni de uso comercial de ninguno de los Productos o servicios de CENT ni de sus contenidos; derecho alguno a compilar ni utilizar lista alguna de productos, descripciones o precios; a descargar o copiar información de cuenta alguna para el beneficio de otra empresa; ni el uso de herramientas o robots de búsqueda y extracción de datos o similar. No podrá usted hacer un uso incorrecto del Sitio y/o App de CENT, sólo le está permitido utilizar el Sitio y/o App de forma lícita. Cualquier incumplimiento por usted de estos Términos y Condiciones supondrá la terminación de las licencias otorgadas por CENT.
          </Text>
          <Text style={styles.termsContentText}>
            CENT hará todo lo posible por garantizar la accesibilidad del Sitio y/o App, aunque no está sujeta a ninguna obligación o responsabilidad en dicho sentido. CENT podrá interrumpir el acceso al Sitio y/o App a efecto de mantenimiento y actualización al mismo, así como por otros motivos, especialmente de carácter técnico; por lo cual no se responsabilizará en ningún caso por dichas interrupciones ni de las consecuencias que éstas puedan generar para el usuario.
          </Text>
          <Text style={styles.termsContentText}>
            Asimismo, CENT hará los esfuerzos necesarios para proporcionar contenidos y servicios de calidad, aunque en ningún caso garantizará la inexistencia de errores, defectos o vicios de diseño que puedan imposibilitar su uso y/o instalación, por lo que no se responsabilizará en ningún caso de las consecuencias, directas o indirectas, y/o de los eventuales daños provocados por defectos en el Sitio y/o App y/o en el contenido del mismo.
          </Text>
        </View>

        {/* Section IV */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsSectionTitle}>IV. SU CUENTA.</Text>
          <Text style={styles.termsContentText}>
            Es posible que usted requiera crear una cuenta de CENT propia, acceder a la misma y efectuar los pagos de manera que queden asociados a su cuenta. En caso de que surja un problema con su método de pago seleccionado, podríamos realizar el cargo a cualquier otro método de pago válido asociado a su cuenta. Cuando usted utiliza el Sitio y/o App, es usted responsable de mantener la confidencialidad de los datos de su cuenta y su contraseña, así como de restringir el acceso a su computadora y demás dispositivos, y usted asume la responsabilidad de cualesquier actividades realizadas desde su cuenta o utilizando su contraseña.
          </Text>
          <Text style={styles.termsContentText}>
            CENT permite el acceso únicamente a mayores de edad, quienes pueden acceder e ingresas sus datos personales, así como datos de métodos de pago, ya sea con tarjeta de crédito, débito u algún otro método. Si es usted menor de 18 años, puede utilizar el Sitio y/o App únicamente con la participación e involucramiento de uno de sus padres o tutores. El incumplimiento a lo anterior otorga el derecho a CENT de reservarse la decisión de validar la veracidad de su información sin responsabilidad alguna y sin necesidad de realizar algún tipo de reembolso, bonificación o devoluciones algunas.
          </Text>
          <Text style={styles.termsContentText}>
            CENT se reserva el derecho de dar de baja cuentas, remover o editar contenido, cancelar órdenes en caso de violación a los presentes Términos y Condiciones o cualquier política, términos y condiciones de CENT, derechos de terceros o comisión de un delito o cualquier conducta que dañe la reputación de CENT o la experiencia al cliente.
          </Text>
        </View>

        {/* Section V */}
        <View style={styles.termsContentSection}>
          <Text style={styles.termsSectionTitle}>V. CUENTAS INACTIVAS.</Text>
          <Text style={styles.termsContentText}>
            A efecto de no contar con cuentas inactivas se consideran las siguientes propuestas de comisiones:
          </Text>
          <Text style={styles.termsContentText}>
            Comisión por cuenta activa: en el evento de que el usuario se haya registrado en el Sitio y/o App Web y haya realizado inversiones activas, transferencias o pagos en la misma durante los últimos 29 días, se aplicará una tarifa de, Cent cobrará $0.00 (Cero Pesos 00/100, Moneda Nacional).
          </Text>
          <Text style={styles.termsContentText}>
            Comisión por cuenta inactiva: en el caso de que el usuario se haya registrado en la aplicación móvil pero no haya efectuado ninguna inversión activa, transferencia o pago en los últimos 30 días, se le impondrá una tarifa diaria de $1.00 (Un Peso 00/100, Moneda Nacional) como comisión por inactividad en cuenta. Se le notificará de esta situación a través de múltiples avisos, siendo el primero enviado 15 días después de la inactividad. Posteriormente, se le informará a los 21 días y, a partir de entonces, se le notificará diariamente. A partir del día 30, se aplicará un cargo diario de $1.00 (Un Peso 00/100, Moneda Nacional) más el Impuesto al Valor Agregado (IVA) hasta que se realice alguna transacción o la cuenta quede vacía. Una vez que la cuenta esté vacía, cesarán los cargos. En caso de que la cuenta tenga algún costo asociado por mantenerla activa, este se suspenderá o, en su caso, se eliminará.
          </Text>
          <Text style={styles.termsContentText}>
            Comisión por cuenta inactiva: Si el usuario realizó un abono antes de registrarse en el Sitio y/o App Web y no ha accedido a la misma en los últimos 21 días para completar su registro, se aplicará una comisión diaria de $5.00 (Cinco Pesos 00/100, Moneda Nacional) más el Impuesto Sobre la Renta (I.S.R.) que se genere por inactividad en la cuenta. El usuario recibirá mensajes diarios desde la fecha de su primer abono, informándole sobre esta situación e invitándole a registrarse o completar su registro. En caso de que la cuenta quede vacía, cesarán los mensajes de aviso.
          </Text>
        </View>

        {/* Continue with remaining sections... */}
        <View style={styles.termsBottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  termsIndexSection: {
    marginBottom: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  termsContentSection: {
    marginBottom: 20,
  },
  termsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
    textAlign: 'center',
  },
  termsIndexList: {
    gap: 4,
  },
  termsIndexItem: {
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  termsContentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'justify',
  },
  termsBottomSpacing: {
    height: 20,
  },
});
