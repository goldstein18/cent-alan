import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Privacy() {
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
        <Text style={styles.title}>Política de Privacidad</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aviso de Privacidad</Text>
          <Text style={styles.contentText}>
            "DEMO APP", S.A.P.I. de C.V., con domicilio en: Calle Ejemplo 123 es responsable de recabar la información de nuestros usuarios y usuarios potenciales, la cual es tratada de forma estrictamente confidencial, y es tan importante como su seguridad al gozar de nuestros beneficios, por lo que hacemos un esfuerzo permanente para salvaguardarla.
          </Text>
        </View>

        {/* Finalidades y Transmisión */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finalidades y Transmisión de los Datos Personales</Text>
          <Text style={styles.contentText}>
            Tenemos la filosofía de mantener una relación estrecha y activa con nuestros usuarios y usuarios potenciales. Al proporcionar sus datos personales (tales como: nombre, fecha de nacimiento, Registro Federal de Contribuyentes, estado civil, sexo, edad, correo electrónico y teléfonos, en caso de usuarios potenciales y, para usuarios además de los anteriores, su domicilio), consiente su tratamiento, con las siguientes finalidades:
          </Text>
        </View>

        {/* Para usuarios */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>Para el caso de usuarios:</Text>
          <View style={styles.listContainer}>
            <Text style={styles.listItem}>• Identificación, verificación y contacto;</Text>
            <Text style={styles.listItem}>• Proveerle los beneficios y productos que ha solicitado;</Text>
            <Text style={styles.listItem}>• Informarle sobre cambios en los mismo;</Text>
            <Text style={styles.listItem}>• Atender quejas, dudas y aclaraciones;</Text>
            <Text style={styles.listItem}>• Conocer sus necesidades;</Text>
            <Text style={styles.listItem}>• Evaluar la calidad de los beneficios que le brindamos;</Text>
            <Text style={styles.listItem}>• Realizar actividades de mercadeo y promoción en general;</Text>
            <Text style={styles.listItem}>• Análisis estadísticos y de mercado;</Text>
            <Text style={styles.listItem}>• Mantener actualizados nuestros registros para poder responder a sus consultas, invitarle a eventos, hacer de su conocimiento nuestras promociones y lanzamientos y mantener nuestra comunicación en general.</Text>
          </View>
          <Text style={styles.noteText}>
            Cabe mencionar que las últimas tres finalidades enlistadas no dan origen a una relación comercial, sino que permiten brindar un mejor servicio por nuestra parte.
          </Text>
        </View>

        {/* Para usuarios potenciales */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>Para el caso de usuarios potenciales:</Text>
          <View style={styles.listContainer}>
            <Text style={styles.listItem}>• Realizar actividades de mercadeo y promoción en general.</Text>
            <Text style={styles.listItem}>• Ofrecerle nuestros beneficios e información de Cent.</Text>
            <Text style={styles.listItem}>• Análisis estadísticos y de mercado.</Text>
            <Text style={styles.listItem}>• Mantener actualizados nuestros registros para poder responder a sus consultas, invitarle a eventos, hacer de su conocimiento nuestras promociones y lanzamientos así como mantener comunicación en general.</Text>
          </View>
          <Text style={styles.noteText}>
            Estas finalidades no dan origen a una relación comercial, sino que están destinadas a brindar un mejor servicio por nuestra parte.
          </Text>
        </View>

        {/* Transferencia de Datos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transferencia de Datos Personales</Text>
          <Text style={styles.contentText}>
            Derivado de las relaciones comerciales que tenemos con nuestras empresas subsidiarias, afiliadas o relacionadas, nuestros distribuidores autorizados y/o terceros proveedores de servicios, es necesario que les transfiramos los datos personales recabados, con las finalidades previstas anteriormente, tanto en el caso de Usuarios como en el caso de Usuarios Potenciales, en virtud de que las primeras son quienes administran los datos recabados, los distribuidores autorizados se encarga de entablar comunicación con los usuarios y usuarios potenciales y los terceros proveedores de servicios resguardan los datos recabados.
          </Text>
          <Text style={styles.contentText}>
            En virtud de lo anterior, cada vez que sea necesario realizar la transferencia de datos, nosotros nos obligamos a transferir el presente aviso de privacidad así como las finalidades expresadas en el mismo, y, el receptor de los datos personales, se obliga en los mismos términos que nosotros, respecto al tratamiento de los mismos.
          </Text>
          <Text style={styles.contentText}>
            En caso de que Usted desee manifestar su negativa a la transferencia de sus datos personales y/o conocer la información de las entidades a quienes sus datos personales pueden ser transferidos, podrá hacerlo mediante la solicitud de Derechos ARCO que se menciona a continuación.
          </Text>
        </View>

        {/* Derechos ARCO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solicitud de Acceso, Rectificación, Cancelación u Oposición de Datos Personales y Revocación del Consentimiento (Solicitud de Derechos ARCO)</Text>
          <Text style={styles.contentText}>
            Todos sus datos personales son tratados de acuerdo a la legislación aplicable y vigente en el país, por ello le informamos que Usted tiene en todo momento el derecho de acceder, rectificar, cancelar u oponerse al tratamiento que le damos a sus datos personales, así como a revocar el consentimiento otorgado para el tratamiento de los mismos; derecho que podrá hacer valer a través de nuestro Centro de Atención a Usuarios, al teléfono: 800-000-0000 o por medio de nuestro correo electrónico: contacto@example.com, para hacerle llegar a su correo electrónico la Solicitud de Derechos ARCO e informarle sobre el proceso a seguir.
          </Text>
          <Text style={styles.contentText}>
            Usted podrá manifestar su negativa a que sus datos personales sean tratados para las finalidades que no generan una relación jurídica y/o comercial con nosotros mediante los mecanismos señalados en el párrafo precedente, durante un plazo de 5 (cinco) días hábiles a partir de que sus datos hayan sido recabados por nosotros.
          </Text>
          <Text style={styles.contentText}>
            Al presentar la Solicitud ARCO o una solicitud de revocación del consentimiento para el tratamiento de sus datos personales en nuestro Centro de Atención a Usuarios por cualquiera de los medios señalados anteriormente y, previamente haber acreditado su identidad o la de su representante legal mediante identificación oficial vigente, Usted recibirá las instrucciones precisas para interponer su SOLICITUD ARCO o la solicitud de revocación del consentimiento para el tratamiento de sus datos personales y el proceso de atención a éstas.
          </Text>
          <Text style={styles.contentText}>
            A través de estos canales Usted podrá actualizar sus datos y especificar el medio por el cual desea recibir información, ya que en caso de no contar con esta especificación de su parte, nosotros estableceremos el canal que consideremos pertinente para enviarle información sobre el procedimiento de interposición y seguimiento de la SOLICITUD ARCO.
          </Text>
        </View>

        {/* Limitación del Uso */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limitación del Uso y Uso de los Datos Personales</Text>
          <Text style={styles.contentText}>
            Si Usted desea limitar el uso o la divulgación de sus datos recabados por nuestra parte, lo podrá hacer a través de nuestro Centro de Atención a Usuarios, al teléfono: 800-000-0001 o por medio de nuestro correo electrónico: contacto@example.com, a fin de que sea inscrito en nuestro Listado de Exclusión, con el fin de identificar su negativa a que sus datos sean tratados para finalidades específicas.
          </Text>
        </View>

        {/* Modificaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modificaciones al Aviso de Privacidad</Text>
          <Text style={styles.contentText}>
            Este aviso de privacidad podrá ser modificado de tiempo en tiempo por nuestra parte, dichas modificaciones serán oportunamente informadas a través de nuestra página en internet example.com o por medio de comunicación oral, impresa o electrónica que determinemos para tal efecto, tal como mediante correo electrónico o llamada telefónica.
          </Text>
        </View>

        {/* Contact Info */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Información de Contacto</Text>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Teléfono:</Text>
            <Text style={styles.contactValue}>800-000-0000</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email:</Text>
            <Text style={styles.contactValue}>contacto@example.com</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Sitio Web:</Text>
            <Text style={styles.contactValue}>example.com</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>Nombre y firma de conformidad:</Text>
          <Text style={styles.footerText}>Firma</Text>
          <Text style={styles.footerDate}>Fecha de última actualización: 23 de noviembre de 2023</Text>
        </View>

        <View style={styles.bottomSpacing} />
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
    textAlign: 'center',
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'justify',
  },
  listContainer: {
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 8,
  },
  contactSection: {
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
    textAlign: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  contactValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  footerSection: {
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footerDate: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  bottomSpacing: {
    height: 20,
  },
});
